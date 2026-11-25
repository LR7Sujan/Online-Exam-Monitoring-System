-- ============================================================================
-- Migration 017: Serverless Realtime Events Table for Polling Fallback
-- ============================================================================

CREATE TABLE IF NOT EXISTS Events (
  event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(128) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_channel_id (channel, event_id),
  INDEX idx_events_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
