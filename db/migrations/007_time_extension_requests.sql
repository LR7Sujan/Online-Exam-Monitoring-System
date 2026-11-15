-- ============================================================================
-- ProctorIQ Migration 007: Time Extension Requests & Dynamic Session Duration
-- ============================================================================

USE proctoriq;

-- 1. Add max_extension_mins to Exams (default 30 mins, 0 disables extensions)
ALTER TABLE Exams
  ADD COLUMN max_extension_mins INT NOT NULL DEFAULT 30 AFTER min_trust_score;

-- 2. Add extra_minutes_granted to Exam_Sessions (default 0)
ALTER TABLE Exam_Sessions
  ADD COLUMN extra_minutes_granted INT NOT NULL DEFAULT 0 AFTER needs_reinstatement;

-- 3. Create Time_Extension_Requests table
CREATE TABLE IF NOT EXISTS Time_Extension_Requests (
  request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  requested_minutes INT NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  granted_minutes INT NULL,
  decided_by INT UNSIGNED NULL,
  decided_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_extension_session (session_id),
  KEY idx_extension_status (status),
  KEY idx_extension_created_at (created_at),
  CONSTRAINT fk_extension_session FOREIGN KEY (session_id) REFERENCES Exam_Sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_extension_decided_by FOREIGN KEY (decided_by) REFERENCES Users(id) ON DELETE SET NULL,
  CONSTRAINT chk_requested_minutes CHECK (requested_minutes >= 1 AND requested_minutes <= 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Update vw_ProctorLiveMonitor to include extra_minutes_granted, max_extension_mins & extension request info
CREATE OR REPLACE VIEW vw_ProctorLiveMonitor AS
SELECT
  es.id AS session_id,
  es.exam_id,
  e.title AS exam_title,
  e.min_trust_score,
  e.duration_minutes,
  e.max_extension_mins,
  es.student_id,
  u.full_name AS student_name,
  u.email AS student_email,
  es.trust_score,
  es.status,
  es.needs_reinstatement,
  es.extra_minutes_granted,
  es.ip_address,
  es.device_fingerprint,
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
  r.integrity_status,
  ter.request_id AS extension_request_id,
  ter.status AS extension_status,
  ter.requested_minutes AS extension_requested_minutes,
  ter.granted_minutes AS extension_granted_minutes,
  ter.reason AS extension_reason,
  ter.created_at AS extension_created_at,
  ter.decided_at AS extension_decided_at,
  ter.decided_by AS extension_decided_by,
  decider.full_name AS extension_decided_by_name
FROM Exam_Sessions es
JOIN Exams e ON e.id = es.exam_id
JOIN Users u ON u.id = es.student_id
LEFT JOIN Time_Extension_Requests ter ON ter.session_id = es.id
LEFT JOIN Users decider ON decider.id = ter.decided_by
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

DELIMITER $$

-- 5. Stored procedure sp_AutoTimeoutExpiredSessions
-- Updates time-left calculation to use duration_minutes + extra_minutes_granted,
-- SKIPS sessions with a PENDING request that has not expired (under 3 minutes),
-- and marks PENDING requests older than 3 minutes as EXPIRED.
DROP PROCEDURE IF EXISTS sp_AutoTimeoutExpiredSessions$$
CREATE PROCEDURE sp_AutoTimeoutExpiredSessions()
BEGIN
  DECLARE v_session_id INT UNSIGNED;
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_processed INT UNSIGNED DEFAULT 0;

  -- 5a. Auto-expire pending requests older than 180 seconds (3 minutes)
  UPDATE Time_Extension_Requests
     SET status = 'EXPIRED'
   WHERE status = 'PENDING'
     AND created_at < DATE_SUB(NOW(), INTERVAL 3 MINUTE);

  -- 5b. Find expired sessions (skip active unexpired PENDING requests)
  BEGIN
    DECLARE cur_expired CURSOR FOR
      SELECT es.id
        FROM Exam_Sessions es
        JOIN Exams e ON e.id = es.exam_id
        LEFT JOIN Time_Extension_Requests ter
          ON ter.session_id = es.id
         AND ter.status = 'PENDING'
         AND ter.created_at >= DATE_SUB(NOW(), INTERVAL 3 MINUTE)
       WHERE es.status = 'IN_PROGRESS'
         AND ter.request_id IS NULL
         AND NOW() > DATE_ADD(es.started_at, INTERVAL (e.duration_minutes + es.extra_minutes_granted) MINUTE);

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
  END;

  SELECT v_processed AS timed_out_sessions_processed;
END$$

-- 6. Stored procedure sp_DecideExtension
-- Transaction with SELECT ... FOR UPDATE on request and session.
-- Only acts if request status is PENDING and session status is IN_PROGRESS.
-- APPROVE adds granted_minutes to session extra_minutes_granted and extends server_deadline.
-- REJECT calls sp_SubmitAndGradeExam with 'TIMEOUT' to grade and set TIMED_OUT (not disqualified).
-- Idempotent against double clicks and cron races.
DROP PROCEDURE IF EXISTS sp_DecideExtension$$
CREATE PROCEDURE sp_DecideExtension(
  IN p_request_id INT UNSIGNED,
  IN p_proctor_id INT UNSIGNED,
  IN p_decision VARCHAR(20),
  IN p_granted_minutes INT UNSIGNED
)
BEGIN
  DECLARE v_session_id INT UNSIGNED;
  DECLARE v_current_req_status ENUM('PENDING','APPROVED','REJECTED','EXPIRED');
  DECLARE v_session_status ENUM('IN_PROGRESS','SUBMITTED','TERMINATED_CHEATING','TIMED_OUT');
  DECLARE v_max_ext INT UNSIGNED;
  DECLARE v_actual_granted INT UNSIGNED DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Lock request
  SELECT session_id, status
    INTO v_session_id, v_current_req_status
    FROM Time_Extension_Requests
   WHERE request_id = p_request_id
     FOR UPDATE;

  IF v_session_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Extension request not found.';
  END IF;

  -- Lock session
  SELECT es.status, COALESCE(e.max_extension_mins, 30)
    INTO v_session_status, v_max_ext
    FROM Exam_Sessions es
    JOIN Exams e ON e.id = es.exam_id
   WHERE es.id = v_session_id
     FOR UPDATE;

  IF v_current_req_status <> 'PENDING' THEN
    -- Already decided or expired
    COMMIT;
    SELECT
      r.request_id,
      r.session_id,
      r.status AS request_status,
      r.granted_minutes,
      r.decided_by,
      r.decided_at,
      es.status AS session_status,
      es.extra_minutes_granted,
      es.server_deadline,
      GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
      TRUE AS already_decided
    FROM Time_Extension_Requests r
    JOIN Exam_Sessions es ON es.id = r.session_id
    WHERE r.request_id = p_request_id;
  ELSEIF v_session_status <> 'IN_PROGRESS' THEN
    -- Session was closed concurrently
    UPDATE Time_Extension_Requests
       SET status = 'EXPIRED',
           decided_by = p_proctor_id,
           decided_at = NOW()
     WHERE request_id = p_request_id;
    COMMIT;
    SELECT
      r.request_id,
      r.session_id,
      r.status AS request_status,
      r.granted_minutes,
      r.decided_by,
      r.decided_at,
      es.status AS session_status,
      es.extra_minutes_granted,
      es.server_deadline,
      GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
      TRUE AS already_decided
    FROM Time_Extension_Requests r
    JOIN Exam_Sessions es ON es.id = r.session_id
    WHERE r.request_id = p_request_id;
  ELSE
    IF p_decision = 'APPROVED' THEN
      SET v_actual_granted = LEAST(COALESCE(p_granted_minutes, 5), v_max_ext);
      IF v_actual_granted < 1 THEN
        SET v_actual_granted = 1;
      END IF;

      UPDATE Time_Extension_Requests
         SET status = 'APPROVED',
             granted_minutes = v_actual_granted,
             decided_by = p_proctor_id,
             decided_at = NOW()
       WHERE request_id = p_request_id;

      UPDATE Exam_Sessions
         SET extra_minutes_granted = extra_minutes_granted + v_actual_granted,
             server_deadline = DATE_ADD(GREATEST(NOW(), server_deadline), INTERVAL v_actual_granted MINUTE)
       WHERE id = v_session_id;

      COMMIT;

      SELECT
        r.request_id,
        r.session_id,
        r.status AS request_status,
        r.granted_minutes,
        r.decided_by,
        r.decided_at,
        es.status AS session_status,
        es.extra_minutes_granted,
        es.server_deadline,
        GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
        FALSE AS already_decided
      FROM Time_Extension_Requests r
      JOIN Exam_Sessions es ON es.id = r.session_id
      WHERE r.request_id = p_request_id;
    ELSE
      -- REJECTED: grade with TIMEOUT trigger so it becomes TIMED_OUT (not disqualified)
      UPDATE Time_Extension_Requests
         SET status = 'REJECTED',
             granted_minutes = 0,
             decided_by = p_proctor_id,
             decided_at = NOW()
       WHERE request_id = p_request_id;

      COMMIT;

      CALL sp_SubmitAndGradeExam(v_session_id, 'TIMEOUT');

      SELECT
        r.request_id,
        r.session_id,
        r.status AS request_status,
        r.granted_minutes,
        r.decided_by,
        r.decided_at,
        es.status AS session_status,
        es.extra_minutes_granted,
        es.server_deadline,
        0 AS seconds_remaining,
        FALSE AS already_decided
      FROM Time_Extension_Requests r
      JOIN Exam_Sessions es ON es.id = r.session_id
      WHERE r.request_id = p_request_id;
    END IF;
  END IF;
END$$

DELIMITER ;

-- 7. Seed short 1-minute exam for time extension scenarios & automated tests
INSERT INTO Exams (id, title, description, duration_minutes, max_extension_mins, min_trust_score, start_window, end_window, is_published, created_by)
VALUES (
  5,
  'CS-101: Speed & Concurrency Quick Check (1 min)',
  'Short 1-minute assessment for rapid deadline, time-extension requests, and proctor verification.',
  1,
  30,
  50,
  DATE_SUB(NOW(), INTERVAL 1 HOUR),
  DATE_ADD(NOW(), INTERVAL 24 HOUR),
  TRUE,
  1
)
ON DUPLICATE KEY UPDATE
  duration_minutes = 1,
  max_extension_mins = 30,
  is_published = TRUE;

INSERT INTO Questions (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
VALUES
  (81, 5, 'Which concurrency anomaly is prevented under strict SERIALIZABLE isolation?', 'Dirty reads and phantom rows', 'Deadlock occurrence', 'Network packet loss', 'Memory buffer allocation', 'A', 2.00, 1),
  (82, 5, 'What does SELECT ... FOR UPDATE acquire on matched rows in MySQL InnoDB?', 'Exclusive (X) row-level locks', 'Shared table locks', 'Non-blocking optimistic counters', 'Ephemeral read locks', 'A', 2.00, 2)
ON DUPLICATE KEY UPDATE
  question_text = VALUES(question_text);

