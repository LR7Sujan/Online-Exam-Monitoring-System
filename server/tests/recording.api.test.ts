import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { executeSql, pool, testDbConnection } from '../src/config/db.js';
import { cleanupExpiredRecordings, getRecordingStorageStats, getRecordingsBaseDir } from '../src/services/recordingService.js';
import type { RowDataPacket } from 'mysql2/promise';

import { getStorageAdapter } from '../src/storage/index.js';

describe('Webcam Exam Recording & Storage API Tests', () => {
  const app = createApp();
  let dbAvailable = false;

  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let testExamId: number;
  let sessionId: number;
  let recordingId: number;

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

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    studentToken = studentRes.body.data.token;

    const otherEmail = `recording.other.${Date.now()}@proctoriq.io`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: otherEmail,
        password: 'Password123!',
        fullName: 'Recording Other Student',
        role: 'STUDENT',
      });
    otherStudentToken = regRes.body.data.token;

    // 2. Create test exam with video recording enabled
    const createExamRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Recording Integration Exam ${Date.now()}`,
        description: 'Exam verifying webcam recording capture, chunking, and streaming.',
        durationMinutes: 45,
        minTrustScore: 60,
        recordVideo: true,
        recordAudio: false,
      });

    testExamId = createExamRes.body.data.id;

    // Add a question
    await request(app)
      .post(`/api/exams/${testExamId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'What protocol does video streaming support?',
        optionA: 'HTTP 206 Partial Content',
        optionB: 'FTP 110',
        optionC: 'SMTP 25',
        optionD: 'DNS 53',
        correctOption: 'A',
        marks: 5,
      });

    // Publish exam
    await request(app)
      .patch(`/api/exams/${testExamId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    // 3. Student starts exam session
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: testExamId });

    sessionId = startRes.body.data.id;
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    // Teardown: clean up files in uploads-test
    try {
      const recDir = path.join(getRecordingsBaseDir(), String(testExamId));
      await fs.rm(recDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    if (sessionId) {
      await executeSql('DELETE FROM Recording_Access_Log WHERE recording_id IN (SELECT recording_id FROM Exam_Recordings WHERE session_id = ?)', [sessionId]);
      await executeSql('DELETE FROM Exam_Recordings WHERE session_id = ?', [sessionId]);
      await executeSql('DELETE FROM Exam_Sessions WHERE id = ?', [sessionId]);
    }
    if (testExamId) {
      await executeSql('DELETE FROM Questions WHERE exam_id = ?', [testExamId]);
      await executeSql('DELETE FROM Exams WHERE id = ?', [testExamId]);
    }
  });

  it('rejects chunk upload by unauthorized student (cross-tenant safety)', async () => {
    if (!dbAvailable) return;
    const dummyChunk = Buffer.from('FAKE_WEBM_CHUNK_0');
    const res = await request(app)
      .put(`/api/sessions/${sessionId}/recording/chunks/0`)
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .set('Content-Type', 'video/webm')
      .send(dummyChunk);

    expect(res.status).toBe(403);
  });

  it('uploads video chunks sequentially and idempotently', async () => {
    if (!dbAvailable) return;
    const dummyChunk0 = Buffer.alloc(1024, 0x1a);
    const dummyChunk1 = Buffer.alloc(1024, 0x42);

    // Upload chunk 0
    const res0 = await request(app)
      .put(`/api/sessions/${sessionId}/recording/chunks/0`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Content-Type', 'video/webm')
      .send(dummyChunk0);

    expect(res0.status).toBe(200);
    expect(res0.body.data.uploaded).toBe(true);
    expect(res0.body.data.chunkIndex).toBe(0);

    // Idempotent re-upload of chunk 0
    const res0Re = await request(app)
      .put(`/api/sessions/${sessionId}/recording/chunks/0`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Content-Type', 'video/webm')
      .send(dummyChunk0);

    expect(res0Re.status).toBe(200);

    // Upload chunk 1
    const res1 = await request(app)
      .put(`/api/sessions/${sessionId}/recording/chunks/1`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Content-Type', 'video/webm')
      .send(dummyChunk1);

    expect(res1.status).toBe(200);
    expect(res1.body.data.chunkIndex).toBe(1);

    // Check DB status is RECORDING
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT recording_id, status FROM Exam_Recordings WHERE session_id = ?',
      [sessionId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('RECORDING');
    recordingId = rows[0].recording_id;
  });

  it('finalizes recording into READY state on session completion', async () => {
    if (!dbAvailable) return;
    const finishRes = await request(app)
      .post(`/api/sessions/${sessionId}/recording/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ durationMs: 20000 });

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.data.status).toBe('READY');
    expect(finishRes.body.data.sizeBytes).toBeGreaterThan(0);
    expect(finishRes.body.data.durationMs).toBeGreaterThanOrEqual(20000);

    // Verify DB
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT status, size_bytes, duration_ms, expires_at FROM Exam_Recordings WHERE recording_id = ?',
      [recordingId]
    );
    expect(rows[0].status).toBe('READY');
    expect(rows[0].size_bytes).toBeGreaterThan(0);
    expect(rows[0].expires_at).not.toBeNull();
  });

  it('enforces RBAC: students are forbidden (403) from accessing recording stream', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`/api/recordings/${recordingId}/stream`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('serves video stream to proctors with HTTP 206 Partial Content Range support', async () => {
    if (!dbAvailable) return;
    // Range request for first 100 bytes
    const res = await request(app)
      .get(`/api/recordings/${recordingId}/stream`)
      .set('Authorization', `Bearer ${proctorToken}`)
      .set('Range', 'bytes=0-99');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-99\/\d+$/);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-type']).toBe('video/webm');
    expect(res.body.length).toBe(100);

    // Verify view was recorded in Recording_Access_Log
    const [logRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM Recording_Access_Log WHERE recording_id = ?',
      [recordingId]
    );
    expect(logRows.length).toBeGreaterThanOrEqual(1);
  });

  it('supports stream authentication via ?token= query parameter', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`/api/recordings/${recordingId}/stream?token=${encodeURIComponent(proctorToken)}`)
      .set('Range', 'bytes=0-49');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-49\/\d+$/);
  });

  it('allows proctors/admins to toggle legal hold', async () => {
    if (!dbAvailable) return;
    const patchRes = await request(app)
      .patch(`/api/recordings/${recordingId}/legal-hold`)
      .set('Authorization', `Bearer ${proctorToken}`)
      .send({ legalHold: true });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.legalHold).toBe(true);

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT legal_hold FROM Exam_Recordings WHERE recording_id = ?',
      [recordingId]
    );
    expect(rows[0].legal_hold).toBe(1);
  });

  it('preserves recordings under legal hold during retention pruning', async () => {
    if (!dbAvailable) return;
    // Backdate expires_at to 10 days ago
    await executeSql(
      'UPDATE Exam_Recordings SET expires_at = DATE_SUB(NOW(), INTERVAL 10 DAY) WHERE recording_id = ?',
      [recordingId]
    );

    // Run cleanup
    const pruned = await cleanupExpiredRecordings();
    expect(pruned).toBe(0);

    // Recording still exists
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT recording_id FROM Exam_Recordings WHERE recording_id = ?',
      [recordingId]
    );
    expect(rows.length).toBe(1);
  });

  it('prunes expired recordings when legal hold is disabled', async () => {
    if (!dbAvailable) return;
    // Remove legal hold
    await executeSql(
      'UPDATE Exam_Recordings SET legal_hold = 0 WHERE recording_id = ?',
      [recordingId]
    );

    // Run cleanup
    const pruned = await cleanupExpiredRecordings();
    expect(pruned).toBe(1);

    // Recording is now deleted
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT recording_id FROM Exam_Recordings WHERE recording_id = ?',
      [recordingId]
    );
    expect(rows.length).toBe(0);
  });

  it('reports disk storage telemetry and enforces safety guard', async () => {
    if (!dbAvailable) return;
    const storageRes = await request(app)
      .get('/api/admin/recordings/storage')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(storageRes.status).toBe(200);
    expect(storageRes.body.data).toHaveProperty('totalSizeBytes');
    expect(storageRes.body.data).toHaveProperty('totalRecordings');
    expect(storageRes.body.data).toHaveProperty('maxStorageBytes');
    expect(storageRes.body.data).toHaveProperty('isExceeded');
    expect(storageRes.body.data.retentionDays).toBe(30);

    const stats = await getRecordingStorageStats();
    expect(stats.retentionDays).toBe(30);
  });

  it('allows admins to manually delete recordings and rejects student delete attempts', async () => {
    if (!dbAvailable) return;
    // 1. Create a dummy recording for delete test in object storage
    const relativePath = path.join('recordings', String(testExamId), String(sessionId), 'recording_del.webm').replace(/\\/g, '/');
    const adapter = getStorageAdapter();
    await adapter.put(relativePath, Buffer.from('TEST_DELETE_VIDEO'), { contentType: 'video/webm' });

    const insRes = await executeSql(
      `INSERT INTO Exam_Recordings (session_id, file_path, mime_type, size_bytes, duration_ms, status, legal_hold, started_at, finished_at, expires_at)
       VALUES (?, ?, 'video/webm', 100, 5000, 'READY', 0, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [sessionId, relativePath]
    );
    const delRecId = insRes.insertId;

    // Students cannot delete (403)
    const studRes = await request(app)
      .delete(`/api/recordings/${delRecId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studRes.status).toBe(403);

    // Admin successfully deletes (200)
    const adminDelRes = await request(app)
      .delete(`/api/recordings/${delRecId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDelRes.status).toBe(200);
    expect(adminDelRes.body.data.deleted).toBe(true);

    // Check DB
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT recording_id FROM Exam_Recordings WHERE recording_id = ?',
      [delRecId]
    );
    expect(rows.length).toBe(0);
  });
});
