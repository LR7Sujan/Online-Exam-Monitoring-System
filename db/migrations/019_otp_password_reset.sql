-- Migration: 019_otp_password_reset.sql
-- Description: OTP-based Password Reset and DB-backed Rate Limiting

-- 1. Add password_changed_at to Users table
ALTER TABLE Users
  ADD COLUMN password_changed_at DATETIME NULL AFTER updated_at;

-- 2. Create Password_Reset_Otps table
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

-- 3. Create Password_Reset_Tokens table
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

-- 4. Create Rate_Limits table for serverless-safe DB-backed rate limiting
CREATE TABLE IF NOT EXISTS Rate_Limits (
  `key` VARCHAR(191) NOT NULL,
  `window_start` DATETIME NOT NULL,
  `count` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`key`),
  INDEX idx_rate_limits_window (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
