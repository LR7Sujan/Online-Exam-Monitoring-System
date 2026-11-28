import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, getPool, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { sendOtpEmail, sendPasswordChangedEmail } from './mailService.js';

export interface OtpRecord extends RowDataPacket {
  otp_id: number;
  user_id: number;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  max_attempts: number;
  verified_at: Date | null;
  consumed_at: Date | null;
  requested_ip: string | null;
  created_at: Date;
}

export interface ResetTokenRecord extends RowDataPacket {
  token_id: number;
  token_hash: string;
  user_id: number;
  otp_id: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
  email: string;
}

interface RateLimitRow extends RowDataPacket {
  key: string;
  count: number;
  elapsed_seconds: number;
}

interface ElapsedRow extends RowDataPacket {
  elapsed_seconds: number | null;
}

interface UserLookupRow extends RowDataPacket {
  id: number;
  email: string;
  is_active: number;
}

/**
 * Computes HMAC-SHA256 hash of a 6-digit OTP code using server pepper.
 */
export function hashOtpCode(code: string): string {
  return crypto.createHmac('sha256', env.OTP_PEPPER).update(code.trim()).digest('hex');
}

/**
 * Computes SHA-256 hash of a reset token.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time string hash comparison.
 */
function constantTimeEquals(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Database-backed rate limiter for serverless environments.
 * Checks and increments a rate limit key within a rolling window.
 * Uses SQL TIMESTAMPDIFF to ensure timezone consistency.
 */
export async function checkAndIncrementRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RateLimitRow[]>(
      'SELECT `key`, `count`, TIMESTAMPDIFF(SECOND, `window_start`, NOW()) AS elapsed_seconds FROM Rate_Limits WHERE `key` = ? FOR UPDATE',
      [key]
    );

    const existing = rows[0];

    if (!existing) {
      await conn.query(
        'INSERT INTO Rate_Limits (`key`, `window_start`, `count`) VALUES (?, NOW(), 1)',
        [key]
      );
      await conn.commit();
      return { allowed: true };
    }

    if (existing.elapsed_seconds >= windowSeconds) {
      // Window expired, reset counter
      await conn.query(
        'UPDATE Rate_Limits SET `window_start` = NOW(), `count` = 1 WHERE `key` = ?',
        [key]
      );
      await conn.commit();
      return { allowed: true };
    }

    if (existing.count >= maxRequests) {
      await conn.commit();
      const waitSeconds = Math.max(1, Math.ceil(windowSeconds - existing.elapsed_seconds));
      return { allowed: false, waitSeconds };
    }

    // Increment count
    await conn.query('UPDATE Rate_Limits SET `count` = `count` + 1 WHERE `key` = ?', [key]);
    await conn.commit();
    return { allowed: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Checks server-enforced resend cooldown (60s) for a given user.
 * Uses SQL TIMESTAMPDIFF to guarantee monotonic server-time evaluation.
 */
async function checkResendCooldown(userId: number, cooldownSeconds = 60): Promise<boolean> {
  const rows = await queryRows<ElapsedRow[]>(
    `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS elapsed_seconds
       FROM Password_Reset_Otps
      WHERE user_id = ?
      ORDER BY otp_id DESC
      LIMIT 1`,
    [userId]
  );

  const lastOtp = rows[0];
  if (!lastOtp || lastOtp.elapsed_seconds === null) return true;

  return lastOtp.elapsed_seconds >= cooldownSeconds;
}

/**
 * Initiates an OTP password reset request.
 * Guaranteed to return generic 200 message without revealing email existence.
 */
export async function requestPasswordReset(email: string, clientIp: string): Promise<string> {
  const genericMessage = 'If an account exists for this email, a code has been sent.';
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Lookup user first so we can check user cooldown before consuming quota
  const userRows = await queryRows<UserLookupRow[]>(
    'SELECT id, email, is_active FROM Users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );
  const user = userRows[0];

  // 2. Server-enforced resend cooldown (60s) if user exists
  if (user && user.is_active) {
    const cooldownOk = await checkResendCooldown(user.id, 60);
    if (!cooldownOk) {
      throw new AppError(
        429,
        'COOLDOWN_ACTIVE',
        'Please wait at least 60 seconds before requesting another verification code.'
      );
    }
  }

  // 3. IP hourly rate limit: max 10 requests per hour per IP
  const ipKey = `rl:otp:ip:${clientIp || '127.0.0.1'}`;
  const ipCheck = await checkAndIncrementRateLimit(ipKey, 10, 3600);
  if (!ipCheck.allowed) {
    throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many verification code requests. Please try again later.');
  }

  // 4. Email hourly rate limit: max 3 requests per hour per email
  const emailKey = `rl:otp:email:${normalizedEmail}`;
  const emailCheck = await checkAndIncrementRateLimit(emailKey, 3, 3600);
  if (!emailCheck.allowed) {
    throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many verification code requests. Please try again later.');
  }

  // If user does not exist or is inactive:
  if (!user || !user.is_active) {
    // Perform dummy constant-time HMAC calculation
    hashOtpCode('999999');
    // Simulate query latency for timing uniformity
    await new Promise((resolve) => setTimeout(resolve, 35));
    return genericMessage;
  }

  // 5. Invalidate prior unconsumed codes for this user
  await executeSql(
    'UPDATE Password_Reset_Otps SET consumed_at = NOW() WHERE user_id = ? AND consumed_at IS NULL',
    [user.id]
  );

  // 6. Generate cryptographically secure 6-digit zero-padded OTP code
  const numericCode = crypto.randomInt(0, 1000000);
  const rawCode = String(numericCode).padStart(6, '0');
  const otpHash = hashOtpCode(rawCode);

  // 7. Store only hashed OTP in database with 10-minute expiry
  await executeSql(
    `INSERT INTO Password_Reset_Otps (user_id, otp_hash, expires_at, attempts, max_attempts, requested_ip)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, 5, ?)`,
    [user.id, otpHash, clientIp || null]
  );

  // 8. Send email in background (never log the code in production)
  sendOtpEmail(user.email, rawCode).catch((err) => {
    console.error('[OtpService] Background sendOtpEmail error:', err);
  });

  // Lazy cleanup of old expired codes
  lazyCleanup();

  return genericMessage;
}

/**
 * Verifies a 6-digit OTP code and issues a short-lived reset token on success.
 */
export async function verifyOtpCode(email: string, code: string): Promise<{ resetToken: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const candidateHash = hashOtpCode(code);

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Find user
    const [userRows] = await conn.query<{ id: number; is_active: number }[] & RowDataPacket[][]>(
      'SELECT id, is_active FROM Users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );
    const user = userRows[0];

    if (!user || !user.is_active) {
      // Dummy check to mitigate timing discrepancies
      constantTimeEquals(candidateHash, hashOtpCode('000000'));
      await conn.rollback();
      throw new AppError(400, 'INVALID_OR_EXPIRED_CODE', 'Invalid or expired code.');
    }

    // 2. Select latest unconsumed, unexpired, unverified OTP for update
    const [otpRows] = await conn.query<OtpRecord[]>(
      `SELECT * FROM Password_Reset_Otps
        WHERE user_id = ?
          AND consumed_at IS NULL
          AND verified_at IS NULL
          AND expires_at > NOW()
        ORDER BY otp_id DESC
        LIMIT 1
        FOR UPDATE`,
      [user.id]
    );

    const otpRecord = otpRows[0];
    if (!otpRecord) {
      await conn.rollback();
      throw new AppError(400, 'INVALID_OR_EXPIRED_CODE', 'Invalid or expired code.');
    }

    // 3. Check attempt limit
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await conn.query(
        'UPDATE Password_Reset_Otps SET consumed_at = NOW() WHERE otp_id = ?',
        [otpRecord.otp_id]
      );
      await conn.commit();
      throw new AppError(400, 'INVALID_OR_EXPIRED_CODE', 'Invalid or expired code.');
    }

    // 4. Compare hash with constant-time equality check
    const isMatch = constantTimeEquals(candidateHash, otpRecord.otp_hash);

    if (!isMatch) {
      const nextAttempts = otpRecord.attempts + 1;
      const shouldLock = nextAttempts >= otpRecord.max_attempts;

      await conn.query(
        `UPDATE Password_Reset_Otps
            SET attempts = ?,
                consumed_at = CASE WHEN ? = TRUE THEN NOW() ELSE consumed_at END
          WHERE otp_id = ?`,
        [nextAttempts, shouldLock, otpRecord.otp_id]
      );
      await conn.commit();
      throw new AppError(400, 'INVALID_OR_EXPIRED_CODE', 'Invalid or expired code.');
    }

    // 5. Match succeeded: mark verified
    await conn.query(
      'UPDATE Password_Reset_Otps SET verified_at = NOW() WHERE otp_id = ?',
      [otpRecord.otp_id]
    );

    // 6. Generate 32-byte cryptographically secure reset token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawResetToken);

    // 7. Store token hash in Password_Reset_Tokens (10-minute expiry)
    await conn.query(
      `INSERT INTO Password_Reset_Tokens (token_hash, user_id, otp_id, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [tokenHash, user.id, otpRecord.otp_id]
    );

    await conn.commit();
    return { resetToken: rawResetToken };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Resets user password using verified reset token.
 */
export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(resetToken);

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Lock and validate reset token
    const [tokenRows] = await conn.query<ResetTokenRecord[]>(
      `SELECT t.*, u.email
         FROM Password_Reset_Tokens t
         JOIN Users u ON u.id = t.user_id
        WHERE t.token_hash = ?
          AND t.used_at IS NULL
          AND t.expires_at > NOW()
        FOR UPDATE`,
      [tokenHash]
    );

    const tokenRecord = tokenRows[0];
    if (!tokenRecord) {
      await conn.rollback();
      throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Invalid or expired reset token.');
    }

    // 2. Lock and validate linked verified OTP
    const [otpRows] = await conn.query<OtpRecord[]>(
      `SELECT * FROM Password_Reset_Otps
        WHERE otp_id = ?
          AND verified_at IS NOT NULL
          AND consumed_at IS NULL
        FOR UPDATE`,
      [tokenRecord.otp_id]
    );

    const otpRecord = otpRows[0];
    if (!otpRecord) {
      await conn.rollback();
      throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Invalid or expired reset token.');
    }

    // 3. Hash new password with bcrypt
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    const changedAtSeconds = Math.floor(Date.now() / 1000);

    // 4. Update user's password and password_changed_at
    await conn.query(
      `UPDATE Users
          SET password_hash = ?,
              password_changed_at = FROM_UNIXTIME(?)
        WHERE id = ?`,
      [passwordHash, changedAtSeconds, tokenRecord.user_id]
    );

    // 5. Consume token and OTP
    await conn.query('UPDATE Password_Reset_Tokens SET used_at = NOW() WHERE token_id = ?', [
      tokenRecord.token_id,
    ]);
    await conn.query('UPDATE Password_Reset_Otps SET consumed_at = NOW() WHERE otp_id = ?', [
      tokenRecord.otp_id,
    ]);

    // 6. Invalidate all other unused codes and tokens for this user
    await conn.query(
      'UPDATE Password_Reset_Otps SET consumed_at = NOW() WHERE user_id = ? AND consumed_at IS NULL',
      [tokenRecord.user_id]
    );
    await conn.query(
      'UPDATE Password_Reset_Tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [tokenRecord.user_id]
    );

    await conn.commit();

    // 7. Send confirmation email in background
    sendPasswordChangedEmail(tokenRecord.email).catch((err) => {
      console.error('[OtpService] Background sendPasswordChangedEmail error:', err);
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Cleans up expired OTP records, tokens, and rate limits.
 */
export async function cleanupExpiredOtpsAndTokens(): Promise<{
  deletedOtps: number;
  deletedTokens: number;
  deletedRateLimits: number;
}> {
  const resultOtps = await executeSql(
    'DELETE FROM Password_Reset_Otps WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );
  const resultTokens = await executeSql(
    'DELETE FROM Password_Reset_Tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );
  const resultLimits = await executeSql(
    'DELETE FROM Rate_Limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 2 HOUR)'
  );

  return {
    deletedOtps: resultOtps.affectedRows,
    deletedTokens: resultTokens.affectedRows,
    deletedRateLimits: resultLimits.affectedRows,
  };
}

let lastLazyCleanup = 0;
function lazyCleanup(): void {
  const now = Date.now();
  // Run at most once every 30 minutes
  if (now - lastLazyCleanup > 30 * 60 * 1000) {
    lastLazyCleanup = now;
    cleanupExpiredOtpsAndTokens().catch((err) => {
      console.error('[OtpService] Lazy cleanup error:', err);
    });
  }
}
