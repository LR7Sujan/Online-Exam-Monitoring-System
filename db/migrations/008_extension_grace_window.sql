-- ============================================================================
-- ProctorIQ Migration 008: Time Extension Grace Window & Awaiting Student Choice State
-- ============================================================================

USE proctoriq;

-- 1. Add time_expired_at column to Exam_Sessions if not exists
-- Tracks the moment regular exam time ended, putting session into "awaiting student choice" grace window
ALTER TABLE Exam_Sessions
  ADD COLUMN time_expired_at DATETIME NULL AFTER server_deadline;

DELIMITER $$

-- 2. Stored procedure sp_AutoTimeoutExpiredSessionsWithGrace(p_grace_seconds INT)
-- Respects the extension grace window (default 180s) when e.max_extension_mins > 0:
-- - Active unexpired PENDING requests (< 180s) block auto-timeout (proctor review in progress)
-- - PENDING requests >= 180s are expired
-- - Sessions without a request stay IN_PROGRESS during grace period (awaiting student choice)
-- - Sessions past grace period (or with max_extension_mins <= 0 past deadline) are timed out & graded
DROP PROCEDURE IF EXISTS sp_AutoTimeoutExpiredSessionsWithGrace$$
CREATE PROCEDURE sp_AutoTimeoutExpiredSessionsWithGrace(IN p_grace_seconds INT)
BEGIN
  DECLARE v_session_id INT UNSIGNED;
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_processed INT UNSIGNED DEFAULT 0;
  DECLARE v_grace INT;

  SET v_grace = COALESCE(p_grace_seconds, 180);

  -- 2a. Auto-expire pending requests older than v_grace seconds (default 3 minutes)
  UPDATE Time_Extension_Requests
     SET status = 'EXPIRED'
   WHERE status = 'PENDING'
     AND created_at < DATE_SUB(NOW(), INTERVAL v_grace SECOND);

  -- 2b. Record time_expired_at for any IN_PROGRESS sessions that reached deadline
  UPDATE Exam_Sessions
     SET time_expired_at = COALESCE(time_expired_at, server_deadline, NOW())
   WHERE status = 'IN_PROGRESS'
     AND NOW() >= server_deadline
     AND time_expired_at IS NULL;

  -- 2c. Find expired sessions to time out
  -- An IN_PROGRESS session is timed out if:
  -- 1) No unexpired PENDING request exists AND
  -- 2) EITHER (COALESCE(max_extension_mins, 0) > 0 AND NOW() > DATE_ADD(server_deadline, INTERVAL v_grace SECOND))
  --    OR     (COALESCE(max_extension_mins, 0) <= 0 AND NOW() > server_deadline)
  BEGIN
    DECLARE cur_expired CURSOR FOR
      SELECT es.id
        FROM Exam_Sessions es
        JOIN Exams e ON e.id = es.exam_id
        LEFT JOIN Time_Extension_Requests ter
          ON ter.session_id = es.id
         AND ter.status = 'PENDING'
         AND ter.created_at >= DATE_SUB(NOW(), INTERVAL v_grace SECOND)
       WHERE es.status = 'IN_PROGRESS'
         AND ter.request_id IS NULL
         AND (
           (COALESCE(e.max_extension_mins, 0) > 0 AND NOW() > DATE_ADD(es.server_deadline, INTERVAL v_grace SECOND))
           OR
           (COALESCE(e.max_extension_mins, 0) <= 0 AND NOW() > es.server_deadline)
         );

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN cur_expired;

    timeout_loop: LOOP
      FETCH cur_expired INTO v_session_id;
      IF v_done THEN
        LEAVE timeout_loop;
      END IF;

      UPDATE Exam_Sessions
         SET status = 'TIMED_OUT',
             ended_at = COALESCE(ended_at, NOW()),
             time_expired_at = COALESCE(time_expired_at, server_deadline, NOW())
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

-- 3. Stored procedure sp_AutoTimeoutExpiredSessions()
-- Wrapper defaulting to 180 seconds grace for backward compatibility
DROP PROCEDURE IF EXISTS sp_AutoTimeoutExpiredSessions$$
CREATE PROCEDURE sp_AutoTimeoutExpiredSessions()
BEGIN
  CALL sp_AutoTimeoutExpiredSessionsWithGrace(180);
END$$

-- 4. Update sp_DecideExtension to clear time_expired_at upon APPROVE
-- If approved, extra minutes are granted and deadline is extended,
-- so time is no longer expired.
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
             server_deadline = DATE_ADD(GREATEST(NOW(), server_deadline), INTERVAL v_actual_granted MINUTE),
             time_expired_at = NULL
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

      UPDATE Exam_Sessions
         SET time_expired_at = COALESCE(time_expired_at, NOW())
       WHERE id = v_session_id;

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

-- 5. Update vw_ProctorLiveMonitor to include time_expired_at and in_grace_window
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
  es.time_expired_at,
  CASE
    WHEN es.status = 'IN_PROGRESS'
     AND COALESCE(e.max_extension_mins, 0) > 0
     AND NOW() >= es.server_deadline
     AND NOW() <= DATE_ADD(es.server_deadline, INTERVAL 180 SECOND)
    THEN 1
    ELSE 0
  END AS in_grace_window,
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
LEFT JOIN Results r ON r.session_id = es.id
LEFT JOIN Time_Extension_Requests ter ON ter.session_id = es.id
LEFT JOIN Users decider ON decider.id = ter.decided_by;

DELIMITER ;
