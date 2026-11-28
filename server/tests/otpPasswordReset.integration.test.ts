import { createServer, type Server } from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { executeSql, pool, testDbConnection } from '../src/config/db.js';
import { clearSentTestEmails, getLastSentOtpCode, getSentTestEmails } from '../src/services/mailService.js';
import {
  hashOtpCode,
  hashResetToken,
  type OtpRecord,
  type ResetTokenRecord,
} from '../src/services/otpService.js';

interface ApiResponse<T> {
  status: number;
  json: {
    success: boolean;
    data: T;
    error: { code: string; message: string; details?: unknown } | null;
  };
}

async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const json = (await res.json()) as ApiResponse<T>['json'];
  return { status: res.status, json };
}

describe('OTP Password Reset API: Complete Security, Rate Limits, and Lifecycle', () => {
  let httpServer: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const dbReady = await testDbConnection();
    if (!dbReady) {
      throw new Error('MySQL 8.0+ not running in test environment.');
    }

    const app = createApp();
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Failed to bind test server');
    }
    baseUrl = `http://127.0.0.1:${address.port}/api`;

    // Clean slate for test tables
    await executeSql('DELETE FROM Password_Reset_Tokens');
    await executeSql('DELETE FROM Password_Reset_Otps');
    await executeSql('DELETE FROM Rate_Limits');
    clearSentTestEmails();

    // Ensure admin user has clean default password and null password_changed_at
    const bcrypt = (await import('bcrypt')).default;
    const defaultHash = await bcrypt.hash('ProctorIQ#2026', 8);
    await executeSql(
      'UPDATE Users SET password_hash = ?, password_changed_at = NULL WHERE email = ?',
      [defaultHash, 'admin@proctoriq.io']
    );
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  // --------------------------------------------------------------------------
  // 1. Unknown email: returns 200 and sends NOTHING
  // --------------------------------------------------------------------------
  it('1. Unknown email returns identical 200 message and sends no email', async () => {
    clearSentTestEmails();
    const res = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent-account-999@proctoriq.io' }),
    });

    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.data.message).toMatch(/If an account exists for this email, a code has been sent/i);

    // Verify no email was dispatched
    const sent = getSentTestEmails();
    const matching = sent.filter((m) => m.to.includes('nonexistent-account-999'));
    expect(matching.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 2. Known email: stores ONLY hash in DB (raw code not in DB) and sends 1 email
  // --------------------------------------------------------------------------
  let studentOtpCode = '';
  it('2. Known email stores only hash in DB and dispatches single OTP email', async () => {
    clearSentTestEmails();
    const res = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ email: 'student@proctoriq.io' }),
    });

    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.data.message).toMatch(/If an account exists for this email, a code has been sent/i);

    // Verify exactly one email sent with 6-digit code
    const sent = getSentTestEmails();
    const matching = sent.filter((m) => m.to === 'student@proctoriq.io');
    expect(matching.length).toBe(1);
    expect(matching[0].otpCode).toBeDefined();
    expect(matching[0].otpCode).toMatch(/^\d{6}$/);
    studentOtpCode = matching[0].otpCode!;

    // Verify DB contains ONLY hash, raw code is nowhere in the DB row
    const [rows] = await pool.query<OtpRecord[]>(
      `SELECT o.*
         FROM Password_Reset_Otps o
         JOIN Users u ON u.id = o.user_id
        WHERE u.email = 'student@proctoriq.io'
        ORDER BY o.otp_id DESC
        LIMIT 1`
    );
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.otp_hash.length).toBe(64);
    expect(row.otp_hash).toBe(hashOtpCode(studentOtpCode));
    expect(row.attempts).toBe(0);
    expect(row.verified_at).toBeNull();
    expect(row.consumed_at).toBeNull();
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  // --------------------------------------------------------------------------
  // 3. Cooldown & Rate Limits
  // --------------------------------------------------------------------------
  it('3. Cooldown (60s) and Rate Limits enforce HTTP 429', async () => {
    // A) Immediate resend within 60s is rejected with 429
    const cooldownRes = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ email: 'student@proctoriq.io' }),
    });
    expect(cooldownRes.status).toBe(429);
    expect(cooldownRes.json.error?.message).toMatch(/60 seconds/i);

    // B) Hourly Email Rate Limit: 3 requests per hour
    // Artificially reset cooldown by backdating created_at in DB
    await executeSql(
      `UPDATE Password_Reset_Otps
          SET created_at = DATE_SUB(NOW(), INTERVAL 120 SECOND)
        WHERE user_id = (SELECT id FROM Users WHERE email = 'student@proctoriq.io')`
    );

    // 2nd request (allowed)
    const res2 = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ email: 'student@proctoriq.io' }),
    });
    expect(res2.status).toBe(200);

    // Backdate cooldown again
    await executeSql(
      `UPDATE Password_Reset_Otps
          SET created_at = DATE_SUB(NOW(), INTERVAL 120 SECOND)
        WHERE user_id = (SELECT id FROM Users WHERE email = 'student@proctoriq.io')`
    );

    // 3rd request (allowed)
    const res3 = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ email: 'student@proctoriq.io' }),
    });
    expect(res3.status).toBe(200);

    // Backdate cooldown again
    await executeSql(
      `UPDATE Password_Reset_Otps
          SET created_at = DATE_SUB(NOW(), INTERVAL 120 SECOND)
        WHERE user_id = (SELECT id FROM Users WHERE email = 'student@proctoriq.io')`
    );

    // 4th request must exceed email hourly rate limit (max 3/hr) -> 429
    const res4 = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ email: 'student@proctoriq.io' }),
    });
    expect(res4.status).toBe(429);
    expect(res4.json.error?.message).toMatch(/Too many verification code requests/i);

    // C) Hourly IP Rate Limit: 10 requests per hour per IP
    const testIp = '192.168.100.99';
    for (let i = 1; i <= 10; i++) {
      await executeSql(
        'INSERT INTO Rate_Limits (`key`, `window_start`, `count`) VALUES (?, NOW(), 1) ON DUPLICATE KEY UPDATE `count` = `count` + 1',
        [`rl:otp:ip:${testIp}`]
      );
    }
    const ipBlockedRes = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: 'proctor@proctoriq.io' }),
    });
    expect(ipBlockedRes.status).toBe(429);
  });

  // --------------------------------------------------------------------------
  // 4. Verification: Wrong code, attempt counter, and 6th-try lock
  // --------------------------------------------------------------------------
  it('4. Wrong code increments attempts and locks after 5 failed tries', async () => {
    // Clear rate limits and request fresh code for proctor
    await executeSql('DELETE FROM Rate_Limits');
    clearSentTestEmails();

    const reqRes = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'proctor@proctoriq.io' }),
    });
    expect(reqRes.status).toBe(200);

    const realCode = getLastSentOtpCode('proctor@proctoriq.io');
    expect(realCode).toBeDefined();

    // Attempts 1 through 5 with wrong code
    for (let attempt = 1; attempt <= 5; attempt++) {
      const wrongRes = await apiFetch<{ resetToken: string }>(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: 'proctor@proctoriq.io', code: '000000' }),
      });
      expect(wrongRes.status).toBe(400);
      expect(wrongRes.json.error?.message).toMatch(/Invalid or expired code/i);

      // Verify attempt count in DB
      const [rows] = await pool.query<OtpRecord[]>(
        `SELECT o.attempts, o.consumed_at
           FROM Password_Reset_Otps o
           JOIN Users u ON u.id = o.user_id
          WHERE u.email = 'proctor@proctoriq.io'
          ORDER BY o.otp_id DESC LIMIT 1`
      );
      expect(rows[0].attempts).toBe(attempt);
      if (attempt === 5) {
        // Locked
        expect(rows[0].consumed_at).not.toBeNull();
      }
    }

    // 6th try with the REAL code must FAIL because code is locked
    const try6Res = await apiFetch<{ resetToken: string }>(baseUrl, '/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: 'proctor@proctoriq.io', code: realCode }),
    });
    expect(try6Res.status).toBe(400);
    expect(try6Res.json.error?.message).toMatch(/Invalid or expired code/i);
  });

  // --------------------------------------------------------------------------
  // 5. Superseded and Expired Codes Fail
  // --------------------------------------------------------------------------
  it('5. Superseded and expired OTP codes fail verification', async () => {
    await executeSql('DELETE FROM Rate_Limits');
    clearSentTestEmails();

    // Request Code A
    const reqARes = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io' }),
    });
    expect(reqARes.status).toBe(200);
    const codeA = getLastSentOtpCode('admin@proctoriq.io');
    expect(codeA).toBeDefined();

    // Backdate cooldown to allow second request
    await executeSql(
      `UPDATE Password_Reset_Otps
          SET created_at = DATE_SUB(NOW(), INTERVAL 120 SECOND)
        WHERE user_id = (SELECT id FROM Users WHERE email = 'admin@proctoriq.io')`
    );

    // Request Code B (supersedes Code A)
    const reqBRes = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io' }),
    });
    expect(reqBRes.status).toBe(200);
    const codeB = getLastSentOtpCode('admin@proctoriq.io');
    expect(codeB).toBeDefined();
    expect(codeA).not.toBe(codeB);

    // Verifying superseded Code A must fail
    const supersededRes = await apiFetch<{ resetToken: string }>(baseUrl, '/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io', code: codeA }),
    });
    expect(supersededRes.status).toBe(400);

    // Expire Code B artificially
    await executeSql(
      `UPDATE Password_Reset_Otps
          SET expires_at = DATE_SUB(NOW(), INTERVAL 10 SECOND)
        WHERE user_id = (SELECT id FROM Users WHERE email = 'admin@proctoriq.io')`
    );

    // Verifying expired Code B must fail
    const expiredRes = await apiFetch<{ resetToken: string }>(baseUrl, '/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io', code: codeB }),
    });
    expect(expiredRes.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // 6. Correct Code Works Once & Parallel Verification Protection
  // --------------------------------------------------------------------------
  let validResetToken = '';
  it('6. Correct code works once; concurrent parallel attempts yield exactly one token', async () => {
    await executeSql('DELETE FROM Rate_Limits');
    await executeSql(
      `UPDATE Password_Reset_Otps
          SET created_at = DATE_SUB(NOW(), INTERVAL 120 SECOND)
        WHERE user_id = (SELECT id FROM Users WHERE email = 'admin@proctoriq.io')`
    );
    clearSentTestEmails();

    // Issue code for admin
    const reqRes = await apiFetch<{ message: string }>(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io' }),
    });
    expect(reqRes.status).toBe(200);
    const adminCode = getLastSentOtpCode('admin@proctoriq.io');
    expect(adminCode).toBeDefined();

    // Send 2 concurrent verification requests with the same code
    const [resA, resB] = await Promise.all([
      apiFetch<{ resetToken: string }>(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@proctoriq.io', code: adminCode }),
      }),
      apiFetch<{ resetToken: string }>(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@proctoriq.io', code: adminCode }),
      }),
    ]);

    const successCount = [resA, resB].filter((r) => r.status === 200).length;
    const failCount = [resA, resB].filter((r) => r.status === 400).length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    const successfulRes = resA.status === 200 ? resA : resB;
    expect(successfulRes.json.data.resetToken).toBeDefined();
    validResetToken = successfulRes.json.data.resetToken;

    // Check DB: token is stored only as SHA-256 hash
    const expectedTokenHash = hashResetToken(validResetToken);
    const [tokenRows] = await pool.query<ResetTokenRecord[]>(
      'SELECT * FROM Password_Reset_Tokens WHERE token_hash = ?',
      [expectedTokenHash]
    );
    expect(tokenRows.length).toBe(1);
    expect(tokenRows[0].used_at).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 7. Password Reset Endpoint Validations & Security
  // --------------------------------------------------------------------------
  it('7. Password reset rejects forged/weak tokens, enforces single-use, and invalidates old sessions', async () => {
    // A) Forged / nonexistent token fails with 400
    const forgedRes = await apiFetch(baseUrl, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        resetToken: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        password: 'NewStrongPassword#2026',
        confirmPassword: 'NewStrongPassword#2026',
      }),
    });
    expect(forgedRes.status).toBe(400);

    // B) Password validation: weak (< 8 chars) fails
    const weakRes = await apiFetch(baseUrl, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        resetToken: validResetToken,
        password: 'short',
        confirmPassword: 'short',
      }),
    });
    expect(weakRes.status).toBe(400);

    // C) Passwords mismatch fails
    const mismatchRes = await apiFetch(baseUrl, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        resetToken: validResetToken,
        password: 'NewStrongPassword#2026',
        confirmPassword: 'MismatchPassword#2026',
      }),
    });
    expect(mismatchRes.status).toBe(400);

    // Acquire an active JWT token for admin BEFORE password reset
    const preResetLogin = await apiFetch<{ token: string }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' }),
    });
    expect(preResetLogin.status).toBe(200);
    const oldAdminJwt = preResetLogin.json.data.token;

    // Verify the old JWT currently works
    const preCheckMe = await apiFetch(baseUrl, '/auth/me', { token: oldAdminJwt });
    expect(preCheckMe.status).toBe(200);

    // Small wait to ensure password_changed_at has clean distinct timestamp second
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // D) Parallel Reset Race Condition: exactly ONE must succeed
    clearSentTestEmails();
    const newPassword = 'NewAdminPassword#2026!';
    const [resetA, resetB] = await Promise.all([
      apiFetch<{ message: string }>(baseUrl, '/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken: validResetToken,
          password: newPassword,
          confirmPassword: newPassword,
        }),
      }),
      apiFetch<{ message: string }>(baseUrl, '/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken: validResetToken,
          password: newPassword,
          confirmPassword: newPassword,
        }),
      }),
    ]);

    const resetSuccesses = [resetA, resetB].filter((r) => r.status === 200).length;
    const resetFailures = [resetA, resetB].filter((r) => r.status === 400).length;
    expect(resetSuccesses).toBe(1);
    expect(resetFailures).toBe(1);

    // Confirmation email dispatched
    const sent = getSentTestEmails();
    const confirmEmail = sent.find(
      (m) => m.to === 'admin@proctoriq.io' && m.subject.includes('Reset')
    );
    expect(confirmEmail).toBeDefined();

    // E) Old password no longer works
    const oldLoginRes = await apiFetch(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' }),
    });
    expect(oldLoginRes.status).toBe(401);

    // F) New password logs in successfully
    const newLoginRes = await apiFetch<{ token: string }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io', password: newPassword }),
    });
    expect(newLoginRes.status).toBe(200);
    const newAdminJwt = newLoginRes.json.data.token;

    // G) Old JWT issued before password_changed_at is REJECTED
    const oldJwtMeRes = await apiFetch(baseUrl, '/auth/me', { token: oldAdminJwt });
    expect(oldJwtMeRes.status).toBe(401);
    expect(oldJwtMeRes.json.error?.code).toBe('TOKEN_REVOKED');

    // H) New JWT works normally
    const newJwtMeRes = await apiFetch(baseUrl, '/auth/me', { token: newAdminJwt });
    expect(newJwtMeRes.status).toBe(200);

    // Restore original admin password for subsequent test suites
    const bcrypt = (await import('bcrypt')).default;
    const defaultHash = await bcrypt.hash('ProctorIQ#2026', 8);
    await executeSql(
      'UPDATE Users SET password_hash = ?, password_changed_at = NULL WHERE email = ?',
      [defaultHash, 'admin@proctoriq.io']
    );
  });

  // --------------------------------------------------------------------------
  // 8. Cron Housekeeping Sweep
  // --------------------------------------------------------------------------
  it('8. Cron housekeeping /api/cron/otp-cleanup cleans up expired records', async () => {
    const cronRes = await apiFetch<{ purged: boolean; message: string }>(
      baseUrl,
      '/cron/otp-cleanup',
      {
        headers: { Authorization: 'Bearer test-cron-secret-token' },
      }
    );
    expect(cronRes.status).toBe(200);
    expect(cronRes.json.success).toBe(true);
    expect(cronRes.json.data.message).toMatch(/cleanup completed/i);
  });
});
