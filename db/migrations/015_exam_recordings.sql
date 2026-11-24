-- Migration 015: Exam Webcam Video Recordings, Access Logs & Retention
-- Phase 20 Step 5

-- 1. Add recording configuration flags to Exams
ALTER TABLE Exams
  ADD COLUMN record_video BOOLEAN NOT NULL DEFAULT 1 AFTER shuffle_options,
  ADD COLUMN record_audio BOOLEAN NOT NULL DEFAULT 0 AFTER record_video;

-- 2. Create Exam_Recordings table
CREATE TABLE IF NOT EXISTS Exam_Recordings (
  recording_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'video/webm',
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('RECORDING', 'READY', 'FAILED') NOT NULL DEFAULT 'RECORDING',
  legal_hold BOOLEAN NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (recording_id),
  UNIQUE KEY uq_recordings_session (session_id),
  KEY idx_recordings_status_expires (status, expires_at),
  KEY idx_recordings_legal_hold (legal_hold),
  CONSTRAINT fk_recordings_session FOREIGN KEY (session_id)
    REFERENCES Exam_Sessions (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Recording_Access_Log table (Audit trail for staff review)
CREATE TABLE IF NOT EXISTS Recording_Access_Log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  recording_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_ral_recording (recording_id),
  KEY idx_ral_user (user_id),
  CONSTRAINT fk_ral_recording FOREIGN KEY (recording_id)
    REFERENCES Exam_Recordings (recording_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ral_user FOREIGN KEY (user_id)
    REFERENCES Users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
