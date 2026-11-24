-- Migration 016: Recording Notes & Enhanced Access Log Actions
-- Phase 20 Step 6

-- 1. Create Recording_Notes table
CREATE TABLE IF NOT EXISTS Recording_Notes (
  note_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  recording_id INT UNSIGNED NOT NULL,
  author_id INT UNSIGNED NOT NULL,
  time_ms INT UNSIGNED NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (note_id),
  KEY idx_rn_recording_time (recording_id, time_ms),
  KEY idx_rn_author (author_id),
  CONSTRAINT fk_rn_recording FOREIGN KEY (recording_id)
    REFERENCES Exam_Recordings (recording_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rn_author FOREIGN KEY (author_id)
    REFERENCES Users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add action column to Recording_Access_Log
ALTER TABLE Recording_Access_Log
  ADD COLUMN action VARCHAR(20) NOT NULL DEFAULT 'VIEW' AFTER user_id;
