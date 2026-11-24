-- ============================================================================
-- Migration 012: Notifications Table for Single Source of Truth
-- Persists user notifications with strict referential integrity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS Notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('VIOLATION', 'WARNING', 'TERMINATION', 'EXTENSION', 'INFO') NOT NULL DEFAULT 'VIOLATION',
  severity ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO') NOT NULL DEFAULT 'MEDIUM',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  session_id INT UNSIGNED NULL,
  student_name VARCHAR(120) NULL,
  exam_title VARCHAR(255) NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, read_at),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_session (session_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_session FOREIGN KEY (session_id) REFERENCES Exam_Sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
