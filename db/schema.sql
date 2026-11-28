-- ============================================================================
-- ProctorIQ: Online Exam Monitoring & Anti-Cheating System
-- Source-of-Truth Database Schema (MySQL 8.0+)
-- ============================================================================
-- Enforces domain integrity directly in SQL via:
--   - Foreign keys, UNIQUE constraints, CHECK constraints
--   - Triggers (trg_before_violation_insert, trg_after_violation_insert,
--               trg_after_violation_review_update, trg_before_response_insert,
--               trg_before_response_update)
--   - Stored Procedures (sp_StartExamSession, sp_SubmitAndGradeExam)
--   - Views (vw_ProctorLiveMonitor, vw_ViolationAuditReport)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS proctoriq
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE proctoriq;

-- ----------------------------------------------------------------------------
-- Clean drop order for idempotent re-initialization
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_ViolationAuditReport;
DROP VIEW IF EXISTS vw_ProctorLiveMonitor;

DROP PROCEDURE IF EXISTS sp_SubmitAndGradeExam;
DROP PROCEDURE IF EXISTS sp_StartExamSession;

DROP TRIGGER IF EXISTS trg_before_response_update;
DROP TRIGGER IF EXISTS trg_before_response_insert;
DROP TRIGGER IF EXISTS trg_after_violation_review_update;
DROP TRIGGER IF EXISTS trg_after_violation_insert;
DROP TRIGGER IF EXISTS trg_before_violation_insert;

DROP TABLE IF EXISTS Results;
DROP TABLE IF EXISTS Proctoring_Logs;
DROP TABLE IF EXISTS Violation_Types;
DROP TABLE IF EXISTS Student_Responses;
DROP TABLE IF EXISTS Exam_Sessions;
DROP TABLE IF EXISTS Questions;
DROP TABLE IF EXISTS Exams;
DROP TABLE IF EXISTS Users;

-- ----------------------------------------------------------------------------
-- 1. Users
-- ----------------------------------------------------------------------------
CREATE TABLE Users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'PROCTOR', 'STUDENT') NOT NULL DEFAULT 'STUDENT',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_changed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Exams
-- ----------------------------------------------------------------------------
CREATE TABLE Exams (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  duration_minutes INT UNSIGNED NOT NULL,
  min_trust_score TINYINT UNSIGNED NOT NULL DEFAULT 50,
  start_window DATETIME NOT NULL,
  end_window DATETIME NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exams_window (is_published, start_window, end_window),
  CONSTRAINT fk_exams_creator FOREIGN KEY (created_by)
    REFERENCES Users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_exams_duration CHECK (duration_minutes > 0),
  CONSTRAINT chk_exams_min_trust CHECK (min_trust_score BETWEEN 0 AND 100),
  CONSTRAINT chk_exams_window CHECK (end_window > start_window)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Questions
-- ----------------------------------------------------------------------------
CREATE TABLE Questions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_id INT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  option_a VARCHAR(500) NOT NULL,
  option_b VARCHAR(500) NOT NULL,
  option_c VARCHAR(500) NOT NULL,
  option_d VARCHAR(500) NOT NULL,
  correct_option ENUM('A', 'B', 'C', 'D') NOT NULL,
  marks DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  order_index INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_questions_exam_order (exam_id, order_index),
  CONSTRAINT fk_questions_exam FOREIGN KEY (exam_id)
    REFERENCES Exams(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_questions_marks CHECK (marks > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Exam_Sessions
-- ----------------------------------------------------------------------------
CREATE TABLE Exam_Sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  trust_score TINYINT UNSIGNED NOT NULL DEFAULT 100,
  status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT')
    NOT NULL DEFAULT 'IN_PROGRESS',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  server_deadline DATETIME NOT NULL,
  ended_at DATETIME NULL,
  last_heartbeat_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_student (exam_id, student_id),
  KEY idx_sessions_status (status),
  KEY idx_sessions_student (student_id, status),
  CONSTRAINT fk_sessions_exam FOREIGN KEY (exam_id)
    REFERENCES Exams(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_student FOREIGN KEY (student_id)
    REFERENCES Users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_sessions_trust CHECK (trust_score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Student_Responses (UPSERT on answer change)
-- ----------------------------------------------------------------------------
CREATE TABLE Student_Responses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  selected_option ENUM('A', 'B', 'C', 'D') NOT NULL,
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_question (session_id, question_id),
  KEY idx_responses_question (question_id),
  CONSTRAINT fk_responses_session FOREIGN KEY (session_id)
    REFERENCES Exam_Sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_responses_question FOREIGN KEY (question_id)
    REFERENCES Questions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Violation_Types
-- ----------------------------------------------------------------------------
CREATE TABLE Violation_Types (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  label VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  penalty_points TINYINT UNSIGNED NOT NULL,
  severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  PRIMARY KEY (id),
  UNIQUE KEY uq_violation_code (code),
  CONSTRAINT chk_violation_penalty CHECK (penalty_points BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Violation_Types (code, label, description, penalty_points, severity) VALUES
  ('TAB_SWITCH',      'Tab / Window Switch',   'Browser tab lost focus or switched to another window.',        15, 'MEDIUM'),
  ('FULLSCREEN_EXIT', 'Fullscreen Exit',       'Candidate exited mandatory fullscreen exam viewport.',         15, 'MEDIUM'),
  ('COPY_PASTE',      'Copy / Paste Attempt',  'Clipboard copy, cut, paste, or context menu intercepted.',     10, 'LOW'),
  ('NO_FACE',         'No Face Detected',      'Webcam telemetry detected absence of candidate face.',         20, 'HIGH'),
  ('MULTIPLE_FACES',  'Multiple Faces',        'More than one face detected in candidate webcam frame.',       35, 'HIGH'),
  ('DEVTOOLS_OPEN',   'DevTools Opened',       'Browser developer tools inspection shortcut or dock detected.',50, 'CRITICAL');

-- ----------------------------------------------------------------------------
-- 7. Proctoring_Logs
-- ----------------------------------------------------------------------------
CREATE TABLE Proctoring_Logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  violation_type_id TINYINT UNSIGNED NOT NULL,
  penalty_applied TINYINT UNSIGNED NOT NULL DEFAULT 0,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evidence_meta JSON NULL,
  snapshot_url VARCHAR(500) NULL,
  proctor_review_status ENUM('PENDING', 'CONFIRMED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_notes VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_logs_session_time (session_id, occurred_at),
  KEY idx_logs_review_status (proctor_review_status, occurred_at),
  CONSTRAINT fk_logs_session FOREIGN KEY (session_id)
    REFERENCES Exam_Sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_logs_violation_type FOREIGN KEY (violation_type_id)
    REFERENCES Violation_Types(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_logs_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES Users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Results
-- ----------------------------------------------------------------------------
CREATE TABLE Results (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  raw_score DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  total_marks DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  final_trust_score TINYINT UNSIGNED NOT NULL,
  integrity_status ENUM('CLEAN', 'FLAGGED', 'DISQUALIFIED') NOT NULL,
  graded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_results_session (session_id),
  KEY idx_results_integrity (integrity_status),
  CONSTRAINT fk_results_session FOREIGN KEY (session_id)
    REFERENCES Exam_Sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_results_trust CHECK (final_trust_score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Password_Reset_Otps
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Password_Reset_Otps (
  otp_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  verified_at DATETIME NULL,
  consumed_at DATETIME NULL,
  requested_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (otp_id),
  CONSTRAINT fk_reset_otps_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_reset_otps_user_created (user_id, created_at),
  INDEX idx_reset_otps_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. Password_Reset_Tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Password_Reset_Tokens (
  token_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  otp_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_reset_tokens_hash (token_hash),
  CONSTRAINT fk_reset_tokens_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reset_tokens_otp FOREIGN KEY (otp_id) REFERENCES Password_Reset_Otps(otp_id) ON DELETE CASCADE,
  INDEX idx_reset_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. Rate_Limits
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Rate_Limits (
  `key` VARCHAR(191) NOT NULL,
  `window_start` DATETIME NOT NULL,
  `count` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`key`),
  INDEX idx_rate_limits_window (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DELIMITER $$

-- ----------------------------------------------------------------------------
-- Trigger: Validate session state and lock authoritative penalty from DB
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_before_violation_insert
BEFORE INSERT ON Proctoring_Logs
FOR EACH ROW
BEGIN
  DECLARE v_session_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_penalty TINYINT UNSIGNED;

  SELECT status
    INTO v_session_status
    FROM Exam_Sessions
   WHERE id = NEW.session_id;

  IF v_session_status IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot log violation: exam session not found.';
  END IF;

  SELECT penalty_points
    INTO v_penalty
    FROM Violation_Types
   WHERE id = NEW.violation_type_id;

  IF v_penalty IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot log violation: invalid violation_type_id.';
  END IF;

  SET NEW.penalty_applied = v_penalty;
  IF NEW.occurred_at IS NULL THEN
    SET NEW.occurred_at = CURRENT_TIMESTAMP;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Trigger: Deduct trust penalty and auto-terminate if below threshold
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_after_violation_insert
AFTER INSERT ON Proctoring_Logs
FOR EACH ROW
BEGIN
  DECLARE v_current_trust TINYINT UNSIGNED;
  DECLARE v_min_trust TINYINT UNSIGNED;
  DECLARE v_session_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_new_trust INT;

  SELECT es.trust_score, es.status, e.min_trust_score
    INTO v_current_trust, v_session_status, v_min_trust
    FROM Exam_Sessions es
    JOIN Exams e ON e.id = es.exam_id
   WHERE es.id = NEW.session_id;

  -- Violations on a non-IN_PROGRESS session do nothing to session state
  IF v_session_status = 'IN_PROGRESS' THEN
    SET v_new_trust = GREATEST(
      0,
      CAST(v_current_trust AS SIGNED) - CAST(NEW.penalty_applied AS SIGNED)
    );

    IF v_new_trust < v_min_trust THEN
      UPDATE Exam_Sessions
         SET trust_score = v_new_trust,
             status = 'TERMINATED_CHEATING',
             ended_at = COALESCE(ended_at, NOW())
       WHERE id = NEW.session_id;
    ELSE
      UPDATE Exam_Sessions
         SET trust_score = v_new_trust
       WHERE id = NEW.session_id;
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Trigger: Adjust trust score when proctor dismisses or re-confirms a log
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_after_violation_review_update
AFTER UPDATE ON Proctoring_Logs
FOR EACH ROW
BEGIN
  DECLARE v_current_trust TINYINT UNSIGNED;
  DECLARE v_min_trust TINYINT UNSIGNED;
  DECLARE v_session_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_adjusted_trust INT;

  IF OLD.proctor_review_status <> NEW.proctor_review_status THEN
    SELECT es.trust_score, es.status, e.min_trust_score
      INTO v_current_trust, v_session_status, v_min_trust
      FROM Exam_Sessions es
      JOIN Exams e ON e.id = es.exam_id
     WHERE es.id = NEW.session_id;

    -- Dismissing a previously active violation restores its penalty
    IF OLD.proctor_review_status IN ('PENDING', 'CONFIRMED')
       AND NEW.proctor_review_status = 'DISMISSED' THEN
      SET v_adjusted_trust = LEAST(
        100,
        CAST(v_current_trust AS SIGNED) + CAST(NEW.penalty_applied AS SIGNED)
      );

      UPDATE Exam_Sessions
         SET trust_score = v_adjusted_trust
       WHERE id = NEW.session_id;

      -- Keep Results synchronized if already graded
      UPDATE Results
         SET final_trust_score = v_adjusted_trust,
             integrity_status = CASE
               WHEN v_session_status = 'TERMINATED_CHEATING' OR v_adjusted_trust < v_min_trust THEN 'DISQUALIFIED'
               WHEN v_adjusted_trust < 100 THEN 'FLAGGED'
               ELSE 'CLEAN'
             END
       WHERE session_id = NEW.session_id;

    -- Re-confirming a previously dismissed violation re-applies its penalty
    ELSEIF OLD.proctor_review_status = 'DISMISSED'
       AND NEW.proctor_review_status IN ('CONFIRMED', 'PENDING') THEN
      SET v_adjusted_trust = GREATEST(
        0,
        CAST(v_current_trust AS SIGNED) - CAST(NEW.penalty_applied AS SIGNED)
      );

      IF v_session_status = 'IN_PROGRESS' AND v_adjusted_trust < v_min_trust THEN
        UPDATE Exam_Sessions
           SET trust_score = v_adjusted_trust,
               status = 'TERMINATED_CHEATING',
               ended_at = COALESCE(ended_at, NOW())
         WHERE id = NEW.session_id;
      ELSE
        UPDATE Exam_Sessions
           SET trust_score = v_adjusted_trust
         WHERE id = NEW.session_id;
      END IF;

      UPDATE Results
         SET final_trust_score = v_adjusted_trust,
             integrity_status = CASE
               WHEN v_session_status = 'TERMINATED_CHEATING' OR v_adjusted_trust < v_min_trust THEN 'DISQUALIFIED'
               ELSE 'FLAGGED'
             END
       WHERE session_id = NEW.session_id;
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Triggers: Prevent response writes after deadline, closure, or wrong exam
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_before_response_insert
BEFORE INSERT ON Student_Responses
FOR EACH ROW
BEGIN
  DECLARE v_exam_id INT UNSIGNED;
  DECLARE v_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_deadline DATETIME;
  DECLARE v_q_exam_id INT UNSIGNED;

  SELECT exam_id, status, server_deadline
    INTO v_exam_id, v_status, v_deadline
    FROM Exam_Sessions
   WHERE id = NEW.session_id;

  IF v_exam_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot save response: exam session not found.';
  END IF;

  IF v_status <> 'IN_PROGRESS' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot save response: exam session is closed.';
  END IF;

  IF NOW() > DATE_ADD(v_deadline, INTERVAL 5 SECOND) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot save response: server deadline has expired.';
  END IF;

  SELECT exam_id
    INTO v_q_exam_id
    FROM Questions
   WHERE id = NEW.question_id;

  IF v_q_exam_id IS NULL OR v_q_exam_id <> v_exam_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot save response: question does not belong to this exam.';
  END IF;
END$$

CREATE TRIGGER trg_before_response_update
BEFORE UPDATE ON Student_Responses
FOR EACH ROW
BEGIN
  DECLARE v_status ENUM('IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT');
  DECLARE v_deadline DATETIME;

  SELECT status, server_deadline
    INTO v_status, v_deadline
    FROM Exam_Sessions
   WHERE id = NEW.session_id;

  IF v_status <> 'IN_PROGRESS' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot update response: exam session is closed.';
  END IF;

  IF NOW() > DATE_ADD(v_deadline, INTERVAL 5 SECOND) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot update response: server deadline has expired.';
  END IF;
END$$

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Start or resume an exam session enforcing server time windows
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_StartExamSession(
  IN p_exam_id INT UNSIGNED,
  IN p_student_id INT UNSIGNED
)
BEGIN
  DECLARE v_role ENUM('ADMIN', 'PROCTOR', 'STUDENT');
  DECLARE v_is_active BOOLEAN;
  DECLARE v_duration INT UNSIGNED;
  DECLARE v_start_window DATETIME;
  DECLARE v_end_window DATETIME;
  DECLARE v_published BOOLEAN;
  DECLARE v_session_id INT UNSIGNED;
  DECLARE v_deadline DATETIME;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT role, is_active
    INTO v_role, v_is_active
    FROM Users
   WHERE id = p_student_id
   FOR UPDATE;

  IF v_role IS NULL OR v_is_active = FALSE THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student account not found or inactive.';
  END IF;

  IF v_role <> 'STUDENT' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only STUDENT accounts can start an exam session.';
  END IF;

  SELECT duration_minutes, start_window, end_window, is_published
    INTO v_duration, v_start_window, v_end_window, v_published
    FROM Exams
   WHERE id = p_exam_id;

  IF v_duration IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Exam not found.';
  END IF;

  IF v_published = FALSE THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Exam is not published yet.';
  END IF;

  -- Check for existing session (idempotent resume)
  SELECT id
    INTO v_session_id
    FROM Exam_Sessions
   WHERE exam_id = p_exam_id AND student_id = p_student_id
   FOR UPDATE;

  IF v_session_id IS NULL THEN
    IF NOW() < v_start_window THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Exam window has not opened yet.';
    END IF;

    IF NOW() > v_end_window THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Exam window has already closed.';
    END IF;

    SET v_deadline = LEAST(v_end_window, DATE_ADD(NOW(), INTERVAL v_duration MINUTE));

    INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline, last_heartbeat_at)
    VALUES (p_exam_id, p_student_id, 100, 'IN_PROGRESS', NOW(), v_deadline, NOW());

    SET v_session_id = LAST_INSERT_ID();
  END IF;

  COMMIT;

  SELECT
    es.*,
    e.title AS exam_title,
    e.duration_minutes,
    e.min_trust_score,
    TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline) AS seconds_remaining
  FROM Exam_Sessions es
  JOIN Exams e ON e.id = es.exam_id
  WHERE es.id = v_session_id;
END$$

-- ----------------------------------------------------------------------------
-- Procedure: Transactional grading with row-level lock (SELECT ... FOR UPDATE)
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
  DECLARE v_existing_result_id INT UNSIGNED;
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

  -- Lock session row to prevent concurrent double-submission / race conditions
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

  -- Idempotency guard: return existing graded result if already finalized
  SELECT id
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
    -- Determine authoritative final session status from server clock & trigger source
    IF v_status = 'IN_PROGRESS' THEN
      IF p_trigger_source = 'TIMEOUT' OR NOW() > DATE_ADD(v_server_deadline, INTERVAL 5 SECOND) THEN
        SET v_final_status = 'TIMED_OUT';
      ELSE
        SET v_final_status = 'SUBMITTED';
      END IF;

      UPDATE Exam_Sessions
         SET status = v_final_status,
             ended_at = NOW()
       WHERE id = p_session_id;
    ELSE
      SET v_final_status = v_status;
      UPDATE Exam_Sessions
         SET ended_at = COALESCE(ended_at, NOW())
       WHERE id = p_session_id;
    END IF;

    -- Grade answers directly in SQL against authoritative Questions table
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
      -- Disqualified / terminated cheater sessions receive 0 score and 0 percentage
      SET v_raw_score = 0.00;
      SET v_percentage = 0.00;
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

DELIMITER ;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Real-time Proctor Mission Control monitor
-- ----------------------------------------------------------------------------
CREATE VIEW vw_ProctorLiveMonitor AS
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

-- ----------------------------------------------------------------------------
-- View: Full Violation Audit & Review Report
-- ----------------------------------------------------------------------------
CREATE VIEW vw_ViolationAuditReport AS
SELECT
  pl.id AS log_id,
  pl.session_id,
  es.exam_id,
  e.title AS exam_title,
  e.min_trust_score,
  es.student_id,
  stu.full_name AS student_name,
  stu.email AS student_email,
  vt.id AS violation_type_id,
  vt.code AS violation_code,
  vt.label AS violation_label,
  vt.severity,
  pl.penalty_applied,
  pl.occurred_at,
  pl.evidence_meta,
  pl.proctor_review_status,
  pl.reviewed_by,
  rev.full_name AS reviewer_name,
  pl.reviewed_at,
  pl.review_notes,
  es.trust_score AS current_trust_score,
  es.status AS session_status,
  r.integrity_status
FROM Proctoring_Logs pl
JOIN Violation_Types vt ON vt.id = pl.violation_type_id
JOIN Exam_Sessions es ON es.id = pl.session_id
JOIN Exams e ON e.id = es.exam_id
JOIN Users stu ON stu.id = es.student_id
LEFT JOIN Users rev ON rev.id = pl.reviewed_by
LEFT JOIN Results r ON r.session_id = es.id;
