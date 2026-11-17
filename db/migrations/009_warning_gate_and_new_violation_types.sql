-- ============================================================================
-- Migration 009: Warning Gate and New Violation Types (PHONE_DETECTED, VOICE_DETECTED)
-- ============================================================================

-- 1. Insert new Violation_Types seeds & ensure MULTIPLE_FACES is 35 points
INSERT INTO Violation_Types (code, label, description, penalty_points, severity)
VALUES
  ('PHONE_DETECTED', 'Mobile Phone Detected', 'Mobile phone visible in camera frame', 25, 'HIGH'),
  ('VOICE_DETECTED', 'Voice / Speech Detected', 'Sustained speech detected on microphone', 15, 'MEDIUM')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  penalty_points = VALUES(penalty_points),
  severity = VALUES(severity);

UPDATE Violation_Types
   SET penalty_points = 35,
       severity = 'HIGH'
 WHERE code = 'MULTIPLE_FACES';

-- 2. Add Warning Gate columns to Exam_Sessions
ALTER TABLE Exam_Sessions
  ADD COLUMN pending_warning_log_id BIGINT UNSIGNED NULL AFTER time_expired_at,
  ADD COLUMN warning_count INT NOT NULL DEFAULT 0 AFTER pending_warning_log_id,
  ADD COLUMN last_warning_ack_at DATETIME NULL AFTER warning_count;

-- 3. Create Session_Warnings table
CREATE TABLE IF NOT EXISTS Session_Warnings (
  warning_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  log_id BIGINT UNSIGNED NOT NULL,
  violation_code VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  penalty_points TINYINT UNSIGNED NOT NULL,
  trust_score_after TINYINT NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME NULL,
  PRIMARY KEY (warning_id),
  KEY idx_sw_session (session_id),
  KEY idx_sw_log (log_id),
  CONSTRAINT fk_sw_session FOREIGN KEY (session_id)
    REFERENCES Exam_Sessions (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sw_log FOREIGN KEY (log_id)
    REFERENCES Proctoring_Logs (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
