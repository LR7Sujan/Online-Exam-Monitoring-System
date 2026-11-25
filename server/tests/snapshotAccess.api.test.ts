import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp, serverUploadsDir } from '../src/app.js';
import { executeSql, pool, testDbConnection } from '../src/config/db.js';
import { assertTestDatabaseSafety } from '../src/config/env.js';
import { generateSignedSnapshotUrl } from '../src/services/snapshotSigner.js';

describe('Forensic Snapshot Security, RBAC, IDOR & Signed URLs', () => {
  assertTestDatabaseSafety('Forensic Snapshot Security Test');
  const app = createApp();
  let dbAvailable = false;

  let adminToken: string;
  let proctorToken: string;
  let ownerStudentToken: string;
  let otherStudentToken: string;
  let otherStudentId: number;
  let testExamId: number;
  let sessionId: number;
  let snapshotRelativeUrl: string;
  let testFilePath: string;

  beforeAll(async () => {
    dbAvailable = await testDbConnection();
    if (!dbAvailable) return;

    // 1. Authenticate users
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    adminToken = adminRes.body.data.token;

    const proctorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' });
    proctorToken = proctorRes.body.data.token;

    const ownerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    ownerStudentToken = ownerRes.body.data.token;

    // Register second student for IDOR check
    const otherEmail = `test.snapshot.other.${Date.now()}@proctoriq.io`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: otherEmail,
        password: 'Password123!',
        fullName: 'Other Student Examinee',
        role: 'STUDENT',
      });
    otherStudentToken = regRes.body.data.token;
    otherStudentId = regRes.body.data.user.id;

    // 2. Create test exam
    const createExamRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Snapshot Auth Test Exam ${Date.now()}`,
        description: 'Testing snapshot permissions, IDOR boundaries and HMAC signed URLs',
        durationMinutes: 45,
        minTrustScore: 60,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What protocol does HTTP/2 use?',
            optionA: 'Binary framing',
            optionB: 'ASCII text',
            optionC: 'Raw UDP',
            optionD: 'COBOL records',
            correctOption: 'A',
            marks: 10,
          },
        ],
      });
    testExamId = createExamRes.body.data.id;

    // 3. Start session for owner student
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${ownerStudentToken}`)
      .send({ examId: testExamId, deviceFingerprint: 'snapshot-test-fingerprint' });
    sessionId = startRes.body.data.id ?? startRes.body.data.session?.id;

    // 4. Create real snapshot file in env.UPLOADS_DIR
    const uploadsDir = serverUploadsDir;

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `snapshot-${sessionId}-${Date.now()}-9999.jpg`;
    testFilePath = path.join(uploadsDir, filename);

    // Minimal valid JPEG buffer (SOI, APP0, DQT, SOF0, DHT, SOS, EOI)
    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync(testFilePath, validJpeg);
    snapshotRelativeUrl = `/uploads/${filename}`;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    // Clean up created snapshot file
    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
      } catch {
        // ignore
      }
    }
    // Clean up database records (Proctoring_Logs is protected by immutability trigger)
    if (sessionId) {
      await executeSql('DELETE FROM Session_Warnings WHERE session_id = ?', [sessionId]);
      await executeSql('DELETE FROM Exam_Sessions WHERE id = ?', [sessionId]);
    }
    if (testExamId) {
      await executeSql('DELETE FROM Questions WHERE exam_id = ?', [testExamId]);
      await executeSql('DELETE FROM Exams WHERE id = ?', [testExamId]);
    }
    if (otherStudentId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [otherStudentId]);
    }
    await pool.end();
  });

  it('1. Rejects request without token (401 UNAUTHORIZED_SNAPSHOT_ACCESS)', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(snapshotRelativeUrl);
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED_SNAPSHOT_ACCESS');
  });

  it('2. Session owner student gets 200 image/jpeg', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(snapshotRelativeUrl)
      .set('Authorization', `Bearer ${ownerStudentToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/(jpeg|jpg)/);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('3. Other student requesting snapshot gets 403 FORBIDDEN (IDOR defense)', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(snapshotRelativeUrl)
      .set('Authorization', `Bearer ${otherStudentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('4. Proctor gets 200 image/jpeg for any session snapshot', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(snapshotRelativeUrl)
      .set('Authorization', `Bearer ${proctorToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/(jpeg|jpg)/);
  });

  it('5. Admin gets 200 image/jpeg for any session snapshot', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(snapshotRelativeUrl)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/(jpeg|jpg)/);
  });

  it('6. Unauthenticated request with valid signed URL gets 200 image/jpeg', async () => {
    if (!dbAvailable) return;
    const signedUrl = generateSignedSnapshotUrl(snapshotRelativeUrl, 101, 300);
    expect(signedUrl).toBeTruthy();

    const res = await request(app).get(signedUrl!);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/(jpeg|jpg)/);
  });

  it('7. Expired signed URL fails with 401 EXPIRED_SNAPSHOT_URL', async () => {
    if (!dbAvailable) return;
    // Create an expired signed URL (expires -10 seconds in the past)
    const expiredUrl = generateSignedSnapshotUrl(snapshotRelativeUrl, 101, -10);
    expect(expiredUrl).toBeTruthy();

    const res = await request(app).get(expiredUrl!);
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('EXPIRED_SNAPSHOT_URL');
  });

  it('8. Tampered signed URL signature fails with 401 INVALID_SNAPSHOT_SIGNATURE', async () => {
    if (!dbAvailable) return;
    const signedUrl = generateSignedSnapshotUrl(snapshotRelativeUrl, 101, 300);
    const tamperedUrl = signedUrl!.replace(/sig=[a-f0-9]{8}/, 'sig=ffffffff');

    const res = await request(app).get(tamperedUrl);
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('INVALID_SNAPSHOT_SIGNATURE');
  });
});
