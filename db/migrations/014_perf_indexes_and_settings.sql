-- ============================================================================
-- Migration 014: Performance Indexes & Admin Detection Settings
-- ============================================================================

-- 1. Index optimizations for fast violation insertion, live lookups, and session locks
ALTER TABLE Exam_Sessions
  ADD INDEX idx_sessions_status_id (status, id);

-- 2. System Settings table for runtime configuration (e.g., instant phone threshold)
CREATE TABLE IF NOT EXISTS System_Settings (
  setting_key VARCHAR(50) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO System_Settings (setting_key, setting_value, description)
VALUES ('phone_confidence_threshold', '0.60', 'Confidence threshold (0.40 - 0.90) for single-frame instant phone detection penalty')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
