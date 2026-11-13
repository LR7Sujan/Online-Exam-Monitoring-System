-- ============================================================================
-- ProctorIQ Migration 002: Integrity Hardening, Auto-Timeout & Analytics
-- Applies cleanly on top of /db/migrations/001_init.sql
-- ============================================================================

USE proctoriq;

-- ----------------------------------------------------------------------------
-- 1a. Add needs_reinstatement flag to Exam_Sessions
-- ----------------------------------------------------------------------------
ALTER TABLE Exam_Sessions
  ADD COLUMN needs_reinstatement BOOLEAN NOT NULL DEFAULT FALSE AFTER status;

CREATE INDEX idx_sessions_reinstatement ON Exam_Sessions (needs_reinstatement, status);

-- ----------------------------------------------------------------------------
-- Clean drop of objects replaced or added in 002
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_violation_review_update;
DROP TRIGGER IF EXISTS trg_after_review_update;
DROP TRIGGER IF EXISTS trg_before_log_delete;
DROP TRIGGER IF EXISTS trg_before_log_update;

DROP PROCEDURE IF EXISTS sp_AutoTimeoutExpiredSessions;
DROP PROCEDURE IF EXISTS sp_SubmitAndGradeExam;

DROP VIEW IF EXISTS vw_ExamAnalytics;
DROP VIEW IF EXISTS vw_ViolationHeatmap;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- 1c. Make Proctoring_Logs immutable (no deletes; only proctor_review_status
--     transitions and their review audit metadata may be updated)
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_before_log_delete
BEFORE DELETE ON Proctoring_Logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Proctoring_Logs is immutable: violation records cannot be deleted.';
END$$

CREATE TRIGGER trg_before_log_update
BEFORE UPDATE ON Proctoring_Logs
FOR EACH ROW
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.session_id <> OLD.session_id
     OR NEW.violation_type_id <> OLD.violation_type_id
     OR NEW.penalty_applied <> OLD.penalty_applied
     OR NEW.occurred_at <> OLD.occurred_at
     OR NOT (NEW.evidence_meta <=> OLD.evidence_meta) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proctoring_Logs is immutable: forensic violation fields cannot be modified.';
  END IF;

  IF NEW.proctor_review_status = OLD.proctor_review_status
     AND (
       NOT (NEW.reviewed_by <=> OLD.reviewed_by)
       OR NOT (NEW.reviewed_at <=> OLD.reviewed_at)
       OR NOT (NEW.review_notes <=> OLD.review_notes)
     ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proctoring_Logs is immutable: only proctor_review_status transitions may be updated.';
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- 1a. Trigger trg_after_review_update:
--     Restores penalty_points (capped at 100) on PENDING -> DISMISSED (and
--     CONFIRMED -> DISMISSED), and sets needs_reinstatement = TRUE if session
--     was TERMINATED_CHEATING due to score and restored score >= min_trust_score.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_after_review_update
AFTER UPDATE ON Proctoring_Logs
FOR EACH ROW
BEGIN
  DECLARE v_penalty TINYINT UNSIGNED DEFAULT 0;
  DECLARE v_current_trust TINYINT UNSIGNED DEFAULT 100;
  DECLARE v_min_trust TINYINT UNSIGNED DEFAULT 50;
  DECLARE v_session_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_restored_trust INT;
  DECLARE v_should_flag_reinstatement BOOLEAN DEFAULT FALSE;

  IF OLD.proctor_review_status <> NEW.proctor_review_status THEN
    SELECT penalty_points
      INTO v_penalty
      FROM Violation_Types
     WHERE id = NEW.violation_type_id;

    SELECT es.trust_score, es.status, e.min_trust_score
      INTO v_current_trust, v_session_status, v_min_trust
      FROM Exam_Sessions es
      JOIN Exams e ON e.id = es.exam_id
     WHERE es.id = NEW.session_id;

    -- PENDING (or CONFIRMED) -> DISMISSED restores penalty_points capped at 100
    IF OLD.proctor_review_status IN ('PENDING', 'CONFIRMED')
       AND NEW.proctor_review_status = 'DISMISSED' THEN
      SET v_restored_trust = LEAST(
        100,
        CAST(v_current_trust AS SIGNED) + CAST(v_penalty AS SIGNED)
      );

      -- Flag for proctor reinstatement without silently reopening the exam
      IF v_session_status = 'TERMINATED_CHEATING'
         AND v_current_trust < v_min_trust
         AND v_restored_trust >= v_min_trust THEN
        SET v_should_flag_reinstatement = TRUE;
      END IF;

      UPDATE Exam_Sessions
         SET trust_score = v_restored_trust,
             needs_reinstatement = IF(v_should_flag_reinstatement, TRUE, needs_reinstatement)
       WHERE id = NEW.session_id;

      UPDATE Results
         SET final_trust_score = v_restored_trust,
             integrity_status = CASE
               WHEN v_session_status = 'TERMINATED_CHEATING' OR v_restored_trust < v_min_trust THEN 'DISQUALIFIED'
               WHEN v_restored_trust < 100 THEN 'FLAGGED'
               ELSE 'CLEAN'
             END
       WHERE session_id = NEW.session_id;

    -- Re-applying penalty if a DISMISSED log is moved back to CONFIRMED/PENDING
    ELSEIF OLD.proctor_review_status = 'DISMISSED'
       AND NEW.proctor_review_status IN ('CONFIRMED', 'PENDING') THEN
      SET v_restored_trust = GREATEST(
        0,
        CAST(v_current_trust AS SIGNED) - CAST(v_penalty AS SIGNED)
      );

      IF v_session_status = 'IN_PROGRESS' AND v_restored_trust < v_min_trust THEN
        UPDATE Exam_Sessions
           SET trust_score = v_restored_trust,
               status = 'TERMINATED_CHEATING',
               ended_at = COALESCE(ended_at, NOW())
         WHERE id = NEW.session_id;
      ELSE
        UPDATE Exam_Sessions
           SET trust_score = v_restored_trust,
               needs_reinstatement = IF(v_restored_trust < v_min_trust, FALSE, needs_reinstatement)
         WHERE id = NEW.session_id;
      END IF;

      UPDATE Results
         SET final_trust_score = v_restored_trust,
             integrity_status = CASE
               WHEN v_session_status = 'TERMINATED_CHEATING' OR v_restored_trust < v_min_trust THEN 'DISQUALIFIED'
               ELSE 'FLAGGED'
             END
       WHERE session_id = NEW.session_id;
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Refresh sp_SubmitAndGradeExam to use aggregate MAX(id) lookup so outer
-- cursors calling it never receive a spurious NOT FOUND (02000) signal.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_SubmitAndGradeExam(
  IN p_session_id INT UNSIGNED,
  IN p_trigger_source VARCHAR(30)
)
BEGIN
  DECLARE v_exam_id INT UNSIGNED;
  DECLARE v_trust_score TINYINT UNSIGNED;
  DECLARE v_min_trust_score TINYINT UNSIGNED;
  DECLARE v_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_server_deadline DATETIME;
  DECLARE v_final_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_existing_result_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_raw_score DECIMAL(8,2) DEFAULT 0.00;
  DECLARE v_total_marks DECIMAL(8,2) DEFAULT 0.00;
  DECLARE v_percentage DECIMAL(5,2) DEFAULT 0.00;
  DECLARE v_active_violations INT DEFAULT 0;
  DECLARE v_integrity_status ENUM('CLEAN', 'FLAGGED', 'DISQUALIFIED');

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT es.exam_id, es.trust_score, es.status, es.server_deadline, e.min_trust_score
    INTO v_exam_id, v_trust_score, v_status, v_server_deadline, v_min_trust_score
    FROM Exam_Sessions es
    JOIN Exams e ON e.id = es.exam_id
   WHERE es.id = p_session_id
   FOR UPDATE;

  IF v_exam_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Exam session not found.';
  END IF;

  SELECT MAX(id)
    INTO v_existing_result_id
    FROM Results
   WHERE session_id = p_session_id
   FOR UPDATE;

  IF v_existing_result_id IS NOT NULL THEN
    COMMIT;
    SELECT r.*, es.status AS session_status, es.exam_id, es.student_id, es.started_at, es.ended_at
      FROM Results r
      JOIN Exam_Sessions es ON es.id = r.session_id
     WHERE r.id = v_existing_result_id;
  ELSE
    IF v_status = 'IN_PROGRESS' THEN
      IF p_trigger_source = 'TIMEOUT' OR NOW() > DATE_ADD(v_server_deadline, INTERVAL 5 SECOND) THEN
        SET v_final_status = 'TIMED_OUT';
      ELSE
        SET v_final_status = 'SUBMITTED';
      END IF;

      UPDATE Exam_Sessions
         SET status = v_final_status,
             ended_at = COALESCE(ended_at, NOW())
       WHERE id = p_session_id;
    ELSE
      SET v_final_status = v_status;
      UPDATE Exam_Sessions
         SET ended_at = COALESCE(ended_at, NOW())
       WHERE id = p_session_id;
    END IF;

    SELECT
      COALESCE(SUM(q.marks), 0.00),
      COALESCE(SUM(CASE WHEN sr.selected_option = q.correct_option THEN q.marks ELSE 0.00 END), 0.00)
      INTO v_total_marks, v_raw_score
      FROM Questions q
      LEFT JOIN Student_Responses sr
        ON sr.question_id = q.id
       AND sr.session_id = p_session_id
     WHERE q.exam_id = v_exam_id;

    IF v_total_marks > 0 THEN
      SET v_percentage = ROUND((v_raw_score / v_total_marks) * 100, 2);
    ELSE
      SET v_percentage = 0.00;
    END IF;

    SELECT COUNT(*)
      INTO v_active_violations
      FROM Proctoring_Logs
     WHERE session_id = p_session_id
       AND proctor_review_status <> 'DISMISSED';

    IF v_final_status = 'TERMINATED_CHEATING' OR v_trust_score < v_min_trust_score THEN
      SET v_integrity_status = 'DISQUALIFIED';
    ELSEIF v_trust_score < 100 OR v_active_violations > 0 THEN
      SET v_integrity_status = 'FLAGGED';
    ELSE
      SET v_integrity_status = 'CLEAN';
    END IF;

    INSERT INTO Results (session_id, raw_score, total_marks, percentage, final_trust_score, integrity_status, graded_at)
    VALUES (p_session_id, v_raw_score, v_total_marks, v_percentage, v_trust_score, v_integrity_status, NOW());

    COMMIT;

    SELECT r.*, es.status AS session_status, es.exam_id, es.student_id, es.started_at, es.ended_at
      FROM Results r
      JOIN Exam_Sessions es ON es.id = r.session_id
     WHERE r.session_id = p_session_id;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- 1b. Stored procedure sp_AutoTimeoutExpiredSessions:
--     Marks IN_PROGRESS sessions past (started_at + duration_minutes) as
--     TIMED_OUT, then grades each via sp_SubmitAndGradeExam.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_AutoTimeoutExpiredSessions()
BEGIN
  DECLARE v_session_id INT UNSIGNED;
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_processed INT UNSIGNED DEFAULT 0;

  DECLARE cur_expired CURSOR FOR
    SELECT es.id
      FROM Exam_Sessions es
      JOIN Exams e ON e.id = es.exam_id
     WHERE es.status = 'IN_PROGRESS'
       AND NOW() > DATE_ADD(es.started_at, INTERVAL e.duration_minutes MINUTE);

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  OPEN cur_expired;

  timeout_loop: LOOP
    FETCH cur_expired INTO v_session_id;
    IF v_done THEN
      LEAVE timeout_loop;
    END IF;

    UPDATE Exam_Sessions
       SET status = 'TIMED_OUT',
           ended_at = COALESCE(ended_at, NOW())
     WHERE id = v_session_id
       AND status = 'IN_PROGRESS';

    CALL sp_SubmitAndGradeExam(v_session_id, 'TIMEOUT');
    SET v_done = FALSE;
    SET v_processed = v_processed + 1;
  END LOOP;

  CLOSE cur_expired;

  SELECT v_processed AS timed_out_sessions_processed;
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- 1d. Analytics Views
-- ----------------------------------------------------------------------------
CREATE VIEW vw_ExamAnalytics AS
SELECT
  e.id AS exam_id,
  e.title AS exam_title,
  e.duration_minutes,
  e.min_trust_score,
  e.start_window,
  e.end_window,
  e.is_published,
  COALESCE(s_agg.total_sessions, 0) AS total_sessions,
  COALESCE(s_agg.in_progress_sessions, 0) AS in_progress_sessions,
  COALESCE(s_agg.terminated_sessions, 0) AS terminated_sessions,
  COALESCE(r_agg.graded_sessions, 0) AS graded_sessions,
  ROUND(COALESCE(r_agg.avg_raw_score, 0.00), 2) AS avg_raw_score,
  ROUND(COALESCE(r_agg.avg_percentage, 0.00), 2) AS avg_percentage,
  ROUND(COALESCE(r_agg.pass_rate_pct, 0.00), 2) AS pass_rate_pct,
  ROUND(COALESCE(s_agg.avg_trust_score, 100.00), 2) AS avg_trust_score,
  COALESCE(v_agg.total_violations, 0) AS total_violations,
  COALESCE(v_agg.pending_violations, 0) AS pending_violations,
  COALESCE(v_agg.confirmed_violations, 0) AS confirmed_violations,
  COALESCE(v_agg.dismissed_violations, 0) AS dismissed_violations
FROM Exams e
LEFT JOIN (
  SELECT
    exam_id,
    COUNT(*) AS total_sessions,
    SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_sessions,
    SUM(CASE WHEN status = 'TERMINATED_CHEATING' THEN 1 ELSE 0 END) AS terminated_sessions,
    AVG(trust_score) AS avg_trust_score
  FROM Exam_Sessions
  GROUP BY exam_id
) s_agg ON s_agg.exam_id = e.id
LEFT JOIN (
  SELECT
    es.exam_id,
    COUNT(r.id) AS graded_sessions,
    AVG(r.raw_score) AS avg_raw_score,
    AVG(r.percentage) AS avg_percentage,
    (SUM(CASE WHEN r.percentage >= 50.00 AND r.integrity_status <> 'DISQUALIFIED' THEN 1 ELSE 0 END) / NULLIF(COUNT(r.id), 0)) * 100 AS pass_rate_pct
  FROM Results r
  JOIN Exam_Sessions es ON es.id = r.session_id
  GROUP BY es.exam_id
) r_agg ON r_agg.exam_id = e.id
LEFT JOIN (
  SELECT
    es.exam_id,
    COUNT(pl.id) AS total_violations,
    SUM(CASE WHEN pl.proctor_review_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_violations,
    SUM(CASE WHEN pl.proctor_review_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_violations,
    SUM(CASE WHEN pl.proctor_review_status = 'DISMISSED' THEN 1 ELSE 0 END) AS dismissed_violations
  FROM Proctoring_Logs pl
  JOIN Exam_Sessions es ON es.id = pl.session_id
  GROUP BY es.exam_id
) v_agg ON v_agg.exam_id = e.id;

CREATE VIEW vw_ViolationHeatmap AS
SELECT
  HOUR(pl.occurred_at) AS hour_of_day,
  vt.code AS violation_code,
  vt.label AS violation_label,
  vt.severity,
  COUNT(*) AS violation_count,
  SUM(pl.penalty_applied) AS total_penalty_points
FROM Proctoring_Logs pl
JOIN Violation_Types vt ON vt.id = pl.violation_type_id
GROUP BY HOUR(pl.occurred_at), vt.code, vt.label, vt.severity
ORDER BY hour_of_day ASC, violation_count DESC;

CREATE OR REPLACE VIEW vw_ProctorLiveMonitor AS
SELECT
  es.id AS session_id,
  es.exam_id,
  e.title AS exam_title,
  e.min_trust_score,
  e.duration_minutes,
  es.student_id,
  u.full_name AS student_name,
  u.email AS student_email,
  es.trust_score,
  es.status,
  es.needs_reinstatement,
  es.started_at,
  es.server_deadline,
  es.ended_at,
  es.last_heartbeat_at,
  GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
  COALESCE(pl_agg.total_violations, 0) AS total_violations,
  COALESCE(pl_agg.pending_violations, 0) AS pending_violations,
  COALESCE(pl_agg.confirmed_violations, 0) AS confirmed_violations,
  COALESCE(pl_agg.dismissed_violations, 0) AS dismissed_violations,
  pl_agg.last_violation_at,
  r.raw_score,
  r.total_marks,
  r.percentage,
  r.integrity_status
FROM Exam_Sessions es
JOIN Exams e ON e.id = es.exam_id
JOIN Users u ON u.id = es.student_id
LEFT JOIN (
  SELECT
    session_id,
    COUNT(*) AS total_violations,
    SUM(CASE WHEN proctor_review_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_violations,
    SUM(CASE WHEN proctor_review_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_violations,
    SUM(CASE WHEN proctor_review_status = 'DISMISSED' THEN 1 ELSE 0 END) AS dismissed_violations,
    MAX(occurred_at) AS last_violation_at
  FROM Proctoring_Logs
  GROUP BY session_id
) pl_agg ON pl_agg.session_id = es.id
LEFT JOIN Results r ON r.session_id = es.id;
