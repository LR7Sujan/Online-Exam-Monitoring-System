import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { executeSql, queryRows } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, '../../');
const uploadsDir = env.UPLOADS_DIR
  ? path.resolve(projectRootDir, env.UPLOADS_DIR)
  : path.resolve(__dirname, '../uploads');

// Valid 1x1 transparent JPEG test fixture with standard FF D8 FF E0 magic bytes
const VALID_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

describe('Sub-Phase 11.4: Comprehensive Security Probes & Vulnerability Audit', () => {
  const app = createApp();

  let adminToken: string;
  let proctorToken: string;
  let studentAToken: string;
  let studentAId: number;
  let studentBToken: string;
  let studentBId: number;

  let testExamId: number;
  let testQuestionId: number;
  let sessionAId: number;
  let sessionBId: number;
  let snapshotFile: string;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // 2. Authenticate Proctor
    const proctorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(proctorRes.status).toBe(200);
    proctorToken = proctorRes.body.data.token;

    // 3. Register Student A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Student Alice',
        email: `student.alice.${Date.now()}@proctoriq.io`,
        password: 'ProctorIQ#2026',
      });
    expect(resA.status).toBe(201);
    studentAToken = resA.body.data.token;
    studentAId = resA.body.data.user.id;

    // 4. Register Student B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Student Bob',
        email: `student.bob.${Date.now()}@proctoriq.io`,
        password: 'ProctorIQ#2026',
      });
    expect(resB.status).toBe(201);
    studentBToken = resB.body.data.token;
    studentBId = resB.body.data.user.id;

    // 5. Create active test exam
    const examRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Security Probe Test Exam',
        description: 'Exam used to audit IDOR, XSS, and tamper protections',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 7200000).toISOString(),
        isPublished: false,
        questions: [
          {
            questionText: 'Security Question Initial',
            optionA: 'Opt A',
            optionB: 'Opt B',
            correctOption: 'A',
            marks: 1,
          },
        ],
      });
    expect(examRes.status).toBe(201);
    testExamId = examRes.body.data.id;

    // Add question
    const qRes = await request(app)
      .post(`/api/exams/${testExamId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'Which HTTP method is idempotent?',
        optionA: 'PUT',
        optionB: 'POST',
        optionC: 'PATCH',
        optionD: 'CONNECT',
        correctOption: 'A',
        marks: 2,
        orderIndex: 1,
      });
    expect(qRes.status).toBe(201);
    testQuestionId = qRes.body.data.id;

    // Publish exam so students can start sessions
    const pubRes = await request(app)
      .patch(`/api/exams/${testExamId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pubRes.status).toBe(200);

    // 6. Start sessions for Student A and Student B
    const startARes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentAToken}`)
      .set('x-device-fingerprint', 'fp-alice-1')
      .send({ examId: testExamId, deviceFingerprint: 'fp-alice-1' });
    expect([200, 201]).toContain(startARes.status);
    sessionAId = startARes.body.data.id;

    const startBRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentBToken}`)
      .set('x-device-fingerprint', 'fp-bob-1')
      .send({ examId: testExamId, deviceFingerprint: 'fp-bob-1' });
    expect([200, 201]).toContain(startBRes.status);
    sessionBId = startBRes.body.data.id;

    // 7. Create a physical snapshot file for upload access testing
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    snapshotFile = `snapshot-${sessionBId}-security-probe.jpg`;
    fs.writeFileSync(path.join(uploadsDir, snapshotFile), Buffer.from(VALID_JPEG_BASE64, 'base64'));
  });

  afterAll(async () => {
    // Clean up created entities
    if (snapshotFile && fs.existsSync(path.join(uploadsDir, snapshotFile))) {
      fs.unlinkSync(path.join(uploadsDir, snapshotFile));
    }
    if (testExamId) {
      await executeSql('DELETE FROM Exams WHERE id = ?', [testExamId]);
    }
    if (studentAId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [studentAId]);
    }
    if (studentBId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [studentBId]);
    }
  });

  // ==========================================================================
  // AREA 1: SQL INJECTION PROBING
  // ==========================================================================
  describe('1. SQL Injection Probing', () => {
    const sqliPayloads = [
      "' OR 1=1 --",
      "admin'#",
      '") OR ("1"="1',
      "'; DROP TABLE Users; --",
      "1' UNION SELECT 1, 'admin', 'hash', 'ADMIN', 1, NOW() --",
    ];

    it.each(sqliPayloads)('rejects SQL injection in login email: %s', async (payload) => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: payload, password: 'password123' });
      // Zod validation rejects invalid email format (400) or DB lookup returns 401
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('rejects SQL injection in query filters: /api/proctor/sessions?status=SQLI', async () => {
      const res = await request(app)
        .get('/api/proctor/sessions')
        .set('Authorization', `Bearer ${proctorToken}`)
        .query({ status: "' OR '1'='1" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects SQL injection in query filters: /api/proctor/logs?reviewStatus=SQLI', async () => {
      const res = await request(app)
        .get('/api/proctor/logs')
        .set('Authorization', `Bearer ${proctorToken}`)
        .query({ reviewStatus: "CONFIRMED' OR 1=1 --" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects SQL injection in :id route parameter: /api/sessions/:id', async () => {
      const res = await request(app)
        .get('/api/sessions/1%27%20OR%201=1%20--')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects SQL injection in :id route parameter: /api/exams/:id/questions', async () => {
      const res = await request(app)
        .get('/api/exams/1;DROP%20TABLE%20Users/questions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // AREA 2: AUTHORIZATION & IDOR PROBING
  // ==========================================================================
  describe('2. Authorization (IDOR) Probing', () => {
    it('blocks Student A from reading Student B session payload (403)', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionBId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student A from reading Student B questions (403)', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionBId}/questions`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student A from reading Student B exam result (403)', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionBId}/result`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student A from submitting answers for Student B (403)', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionBId}/response`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ questionId: testQuestionId, selectedOption: 'A' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student A from viewing forensic snapshot in /uploads (403)', async () => {
      const res = await request(app)
        .get(`/uploads/${snapshotFile}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student from accessing Proctor live monitor (403)', async () => {
      const res = await request(app)
        .get('/api/proctor/sessions')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student from accessing Proctor audit report (403)', async () => {
      const res = await request(app)
        .get('/api/proctor/logs')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student from accessing Admin user list (403)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Proctor from accessing Admin user list (403)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${proctorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Proctor from creating violation types (Admin-only) (403)', async () => {
      const res = await request(app)
        .post('/api/violation-types')
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({
          code: 'UNAUTHORIZED_TYPE',
          label: 'Unauthorized Type',
          penaltyPoints: 10,
          severity: 'LOW',
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================================================
  // AREA 3: TAMPERING & STATE FORGERY PROBING
  // ==========================================================================
  describe('3. Tampering & Client State Forgery Probing', () => {
    it('ignores client-forged trust_score and status on session start', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('x-device-fingerprint', 'fp-alice-1')
        .send({
          examId: testExamId,
          deviceFingerprint: 'fp-alice-1',
          trust_score: 999,
          status: 'SUBMITTED',
          score: 100,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.trust_score).toBe(100);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('ignores client-supplied timestamps and scores on answer upsert', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionAId}/response`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'A',
          score: 100,
          raw_score: 100,
          answered_at: '2099-12-31T23:59:59.000Z',
        });
      expect(res.status).toBe(200);

      // Verify the response in MySQL has server timestamp, not forged 2099
      const rows = await queryRows<RowDataPacket[]>(
        'SELECT answered_at FROM Student_Responses WHERE session_id = ? AND question_id = ?',
        [sessionAId, testQuestionId]
      );
      const answeredYear = new Date(rows[0].answered_at).getFullYear();
      expect(answeredYear).toBeLessThan(2090);
    });

    it('calculates remaining time from server clock, ignoring client time values', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionAId}/time-left`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .set('x-client-time', '2099-01-01T00:00:00Z');
      expect(res.status).toBe(200);
      expect(typeof res.body.data.secondsRemaining).toBe('number');
      expect(res.body.data.secondsRemaining).toBeGreaterThan(0);
      expect(res.body.data.secondsRemaining).toBeLessThanOrEqual(3600);
    });
  });

  // ==========================================================================
  // AREA 4: JWT SECURITY PROBING
  // ==========================================================================
  describe('4. JWT Security Probing', () => {
    it('rejects unauthenticated request with missing token (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired JWT token (401)', async () => {
      const expiredToken = jwt.sign(
        { sub: studentAId, email: 'alice@proctoriq.io', role: 'STUDENT', fullName: 'Alice' },
        env.JWT_SECRET,
        { expiresIn: '-10s' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects tampered JWT signature (401)', async () => {
      const tampered = studentAToken.slice(0, -6) + 'abcdef';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tampered}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects forged token signed with an invalid attacker secret (401)', async () => {
      const forgedToken = jwt.sign(
        { sub: studentAId, email: 'alice@proctoriq.io', role: 'ADMIN', fullName: 'Alice' },
        'forged-attacker-secret-key-12345'
      );
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  // ==========================================================================
  // AREA 5: XSS PAYLOAD PROBING
  // ==========================================================================
  describe('5. XSS Payload Probing & UI Escaping', () => {
    it('stores and returns script payload in user full_name without execution or mutation', async () => {
      const xssName = '<script>alert("XSS_USER")</script>';
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: xssName,
          email: `xss.user.${Date.now()}@proctoriq.io`,
          password: 'ProctorIQ#2026',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.user.fullName).toBe(xssName);

      // Verify in DB that it is stored parameterized literally, not executed
      const rows = await queryRows<RowDataPacket[]>(
        'SELECT full_name FROM Users WHERE id = ?',
        [res.body.data.user.id]
      );
      expect(rows[0].full_name).toBe(xssName);
      await executeSql('DELETE FROM Users WHERE id = ?', [res.body.data.user.id]);
    });

    it('stores script payload in exam title safely', async () => {
      const xssTitle = '<img src=x onerror=alert("XSS_EXAM")>';
      const res = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: xssTitle,
          durationMinutes: 45,
          startWindow: new Date(Date.now() - 3600000).toISOString(),
          endWindow: new Date(Date.now() + 7200000).toISOString(),
          isPublished: false,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(xssTitle);
      await executeSql('DELETE FROM Exams WHERE id = ?', [res.body.data.id]);
    });

    it('stores SVG XSS payload in question text safely', async () => {
      await executeSql('UPDATE Exams SET is_published = FALSE WHERE id = ?', [testExamId]);
      const xssQuestion = '<svg/onload=alert("XSS_QUESTION")>';
      const res = await request(app)
        .post(`/api/exams/${testExamId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          questionText: xssQuestion,
          optionA: 'Option 1',
          optionB: 'Option 2',
          optionC: 'Option 3',
          optionD: 'Option 4',
          correctOption: 'B',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.question_text || res.body.data.questionText).toBe(xssQuestion);
      await executeSql('DELETE FROM Questions WHERE id = ?', [res.body.data.id]);
      await executeSql('UPDATE Exams SET is_published = TRUE WHERE id = ?', [testExamId]);
    });

    it('verifies client codebase contains zero dangerouslySetInnerHTML references', () => {
      const clientSrcDir = path.resolve(projectRootDir, 'client/src');
      function checkDirForDanger(dir: string): string[] {
        const results: string[] = [];
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            results.push(...checkDirForDanger(fullPath));
          } else if (/\.(tsx|ts|jsx|js)$/.test(file)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('dangerouslySetInnerHTML')) {
              results.push(fullPath);
            }
          }
        }
        return results;
      }

      const dangerousFiles = checkDirForDanger(clientSrcDir);
      expect(dangerousFiles).toEqual([]);
    });
  });

  // ==========================================================================
  // AREA 6: HEADERS, CORS & CONFIGURATION PROBING
  // ==========================================================================
  describe('6. Headers, CORS & Configuration Security', () => {
    it('sets Helmet security headers (nosniff, sameorigin)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-download-options']).toBe('noopen');
    });

    it('restricts CORS origin header for untrusted third-party origins', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://untrusted-malicious-site.com');
      expect(res.status).toBe(200);
      // Access-Control-Allow-Origin must NOT reflect the malicious origin
      expect(res.headers['access-control-allow-origin']).not.toBe('http://untrusted-malicious-site.com');
      expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_ORIGIN.split(',')[0].trim());
    });

    it('does not leak internal error stack traces in error responses', async () => {
      const res = await request(app).get('/api/non-existent-route-for-testing-stack-leak');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(res.body.error.stack).toBeUndefined();
      expect(res.body.stack).toBeUndefined();
    });

    it('attaches standard rate limit headers to authentication endpoints', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  // ==========================================================================
  // AREA 7: UPLOADS & FORENSIC SNAPSHOT SECURITY
  // ==========================================================================
  describe('7. Uploads & Forensic Snapshot Security', () => {
    it('rejects non-image snapshot upload (text/html) with 400', async () => {
      const htmlBase64 = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
      const res = await request(app)
        .post(`/api/sessions/${sessionAId}/violation`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          code: 'MULTIPLE_FACES',
          snapshot: htmlBase64,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SNAPSHOT_FORMAT');
    });

    it('rejects non-image raw binary data without valid image magic bytes with 400', async () => {
      // 100 bytes of non-image binary ASCII
      const fakeBinaryBase64 = Buffer.from('NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT_CONTENT_12345').toString('base64');
      const res = await request(app)
        .post(`/api/sessions/${sessionAId}/violation`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          code: 'MULTIPLE_FACES',
          snapshot: fakeBinaryBase64,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SNAPSHOT_FORMAT');
    });

    it('rejects oversized snapshot upload (> 2MB) with 400', async () => {
      // Allocate 2.5MB oversized buffer
      const oversizedBuf = Buffer.alloc(2.5 * 1024 * 1024, 0xff);
      oversizedBuf[0] = 0xff;
      oversizedBuf[1] = 0xd8;
      oversizedBuf[2] = 0xff; // fake JPEG magic header
      const oversizedBase64 = oversizedBuf.toString('base64');

      const res = await request(app)
        .post(`/api/sessions/${sessionAId}/violation`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          code: 'MULTIPLE_FACES',
          snapshot: oversizedBase64,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SNAPSHOT_OVERSIZED');
    });

    it('rejects path traversal attempts in snapshot path with 400', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionAId}/violation`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          code: 'MULTIPLE_FACES',
          snapshot: '/uploads/../../etc/passwd',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SNAPSHOT_PATH');
    });

    it('accepts valid JPEG optical snapshot upload with 200/201', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionAId}/violation`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          code: 'NO_FACE',
          snapshot: `data:image/jpeg;base64,${VALID_JPEG_BASE64}`,
          evidenceMeta: { reason: 'Camera unobstructed face lost' },
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.data.snapshot_url || res.body.data.snapshotUrl).toBeDefined();
    });

    it('blocks unauthenticated access to /uploads (401)', async () => {
      const res = await request(app).get(`/uploads/${snapshotFile}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED_SNAPSHOT_ACCESS');
    });

    it('allows Proctor role to access snapshot in /uploads (200)', async () => {
      const res = await request(app)
        .get(`/uploads/${snapshotFile}`)
        .set('Authorization', `Bearer ${proctorToken}`);
      expect(res.status).toBe(200);
    });

    it('allows Admin role to access snapshot in /uploads (200)', async () => {
      const res = await request(app)
        .get(`/uploads/${snapshotFile}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // AREA 8: PASSWORD HYGIENE & BCRYPT VERIFICATION
  // ==========================================================================
  describe('8. Password Storage & Information Leak Auditing', () => {
    it('verifies all user passwords in database are bcrypt hashes', async () => {
      const rows = await queryRows<RowDataPacket[]>('SELECT password_hash FROM Users LIMIT 20');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.password_hash).toMatch(/^\$2[ab]\$\d{2}\$/);
      }
    });

    it('POST /api/auth/register never returns password_hash', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Secret Test Candidate',
          email: `secret.test.${Date.now()}@proctoriq.io`,
          password: 'ProctorIQ#2026',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
      await executeSql('DELETE FROM Users WHERE id = ?', [res.body.data.user.id]);
    });

    it('POST /api/auth/login never returns password_hash', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
      expect(res.status).toBe(200);
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('GET /api/auth/me never returns password_hash', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.password_hash).toBeUndefined();
      expect(res.body.data.password).toBeUndefined();
    });

    it('GET /api/admin/users never returns password_hash for any user row', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const user of res.body.data) {
        expect(user.password_hash).toBeUndefined();
        expect(user.password).toBeUndefined();
      }
    });
  });
});
