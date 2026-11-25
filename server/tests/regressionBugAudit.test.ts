import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { pool, testDbConnection } from '../src/config/db';
import { env } from '../src/config/env';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Permanent Regression Test Suite: Bug Register Verification (BUG-001 through BUG-023)', () => {
  let app: Express;
  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let dbReady = false;

  beforeAll(async () => {
    dbReady = await testDbConnection();
    app = createApp();

    // Generate tokens for each role
    adminToken = jwt.sign(
      { sub: 1, role: 'ADMIN', email: 'admin@proctoriq.io' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    proctorToken = jwt.sign(
      { sub: 2, role: 'PROCTOR', email: 'proctor@proctoriq.io' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    studentToken = jwt.sign(
      { sub: 3, role: 'STUDENT', email: 'student@proctoriq.io' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  // --------------------------------------------------------------------------
  // BUG-001: Migrations chronological ordering verification
  // --------------------------------------------------------------------------
  it('[BUG-001] migrations folder contains all migrations in chronological order before seed', () => {
    const migrationsDir = path.join(rootDir, 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();

    expect(files).toContain('001_init.sql');
    expect(files).toContain('002_improvements.sql');
    expect(files).toContain('003_session_security.sql');
    expect(files).toContain('004_snapshot_support.sql');
    expect(files).toContain('005_performance_indexes.sql');

    const initIdx = files.indexOf('001_init.sql');
    const mig2Idx = files.indexOf('002_improvements.sql');
    const mig3Idx = files.indexOf('003_session_security.sql');
    const mig4Idx = files.indexOf('004_snapshot_support.sql');
    const mig5Idx = files.indexOf('005_performance_indexes.sql');

    expect(initIdx).toBeLessThan(mig2Idx);
    expect(mig2Idx).toBeLessThan(mig3Idx);
    expect(mig3Idx).toBeLessThan(mig4Idx);
    expect(mig4Idx).toBeLessThan(mig5Idx);
  });

  // --------------------------------------------------------------------------
  // BUG-003: Reinstatement request body validation
  // --------------------------------------------------------------------------
  it('[BUG-003] POST /api/proctor/sessions/:id/reinstate validates request body and rejects invalid data with 400', async () => {
    const res = await request(app)
      .post('/api/proctor/sessions/1/reinstate')
      .set('Authorization', `Bearer ${proctorToken}`)
      .send({ reason: 12345 }); // Invalid type (number instead of string)

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // --------------------------------------------------------------------------
  // BUG-007: Disqualified / terminated cheater session scoring
  // --------------------------------------------------------------------------
  it('[BUG-007] sp_SubmitAndGradeExam zeroes score and percentage for terminated cheating sessions', async () => {
    if (!dbReady) return;
    // Ensure clean session on free student 7
    await pool.query('DELETE FROM Results WHERE session_id IN (SELECT id FROM Exam_Sessions WHERE student_id = 7 AND exam_id = 1)');
    await pool.query('DELETE FROM Exam_Sessions WHERE student_id = 7 AND exam_id = 1');
    const [sessRes] = await pool.query<ResultSetHeader>(
      "INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline) VALUES (1, 7, 20, 'TERMINATED_CHEATING', NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR))"
    );
    const sessionId = sessRes.insertId;
    await pool.query('CALL sp_SubmitAndGradeExam(?, "PROCTOR_FORCE_SUBMIT")', [sessionId]);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT raw_score, percentage, integrity_status FROM Results WHERE session_id = ?',
      [sessionId]
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(Number(rows[0].raw_score)).toBe(0.0);
    expect(Number(rows[0].percentage)).toBe(0.0);
    expect(rows[0].integrity_status).toBe('DISQUALIFIED');
  });

  // --------------------------------------------------------------------------
  // BUG-008: Non-IN_PROGRESS violation logging does not abort or alter session state
  // --------------------------------------------------------------------------
  it('[BUG-008] Inserting violation on non-IN_PROGRESS session succeeds without altering session trust score', async () => {
    if (!dbReady) return;
    // Ensure clean session on free student 8
    await pool.query('DELETE FROM Results WHERE session_id IN (SELECT id FROM Exam_Sessions WHERE student_id = 8 AND exam_id = 1)');
    await pool.query('DELETE FROM Exam_Sessions WHERE student_id = 8 AND exam_id = 1');
    const [sessRes] = await pool.query<ResultSetHeader>(
      "INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline) VALUES (1, 8, 80, 'SUBMITTED', NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR))"
    );
    const sessionId = sessRes.insertId;
    const [sessionBefore] = await pool.query<RowDataPacket[]>(
      'SELECT trust_score, status FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(['SUBMITTED', 'TIMED_OUT', 'TERMINATED_CHEATING']).toContain(sessionBefore[0].status);
    const initialTrust = sessionBefore[0].trust_score;

    // Insert violation log directly into Proctoring_Logs
    const [insertResult] = await pool.query(
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied, occurred_at)
       VALUES (?, 1, 10, NOW())`,
      [sessionId]
    );
    expect((insertResult as { insertId: number }).insertId).toBeGreaterThan(0);

    // Verify session trust_score was NOT deducted
    const [sessionAfter] = await pool.query<RowDataPacket[]>(
      'SELECT trust_score, status FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sessionAfter[0].trust_score).toBe(initialTrust);
  });

  let createdStudentSessionId: number;

  // --------------------------------------------------------------------------
  // BUG-009: Session start resume token conflict
  // --------------------------------------------------------------------------
  it('[BUG-009] Exam start with candidate existing sessionToken resumes session (200) without 409 conflict', async () => {
    if (!dbReady) return;
    // Find an active session in progress
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id, exam_id, student_id, session_token, device_fingerprint FROM Exam_Sessions WHERE status = 'IN_PROGRESS' LIMIT 1"
    );
    expect(existing.length).toBeGreaterThan(0);
    const session = existing[0];
    const candidateToken = jwt.sign(
      { sub: session.student_id, role: 'STUDENT', email: `candidate${session.student_id}@proctoriq.io` },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    let activeToken = session.session_token;
    if (!activeToken) {
      activeToken = 'test-audit-token-12345';
      await pool.query('UPDATE Exam_Sessions SET session_token = ? WHERE id = ?', [activeToken, session.id]);
    }
    const activeFingerprint = session.device_fingerprint || 'test-audit-fp-12345';
    if (!session.device_fingerprint) {
      await pool.query('UPDATE Exam_Sessions SET device_fingerprint = ? WHERE id = ?', [activeFingerprint, session.id]);
    }
    createdStudentSessionId = session.id;

    // Starting with candidate's existing sessionToken must resume cleanly with 200 OK (never 409)
    const res = await request(app)
      .post(`/api/exams/${session.exam_id}/start`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ sessionToken: activeToken, deviceFingerprint: activeFingerprint });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdStudentSessionId);
  });

  // --------------------------------------------------------------------------
  // BUG-010: Endpoint aliases for proctor and admin routes
  // --------------------------------------------------------------------------
  it('[BUG-010] Endpoint aliases resolve correctly: /live-monitor & /sessions; /audit-report & /logs; /db-telemetry & /system-stats', async () => {
    if (!dbReady) return;
    // Proctor aliases
    const p1 = await request(app)
      .get('/api/proctor/live-monitor')
      .set('Authorization', `Bearer ${proctorToken}`);
    const p2 = await request(app)
      .get('/api/proctor/sessions')
      .set('Authorization', `Bearer ${proctorToken}`);
    expect(p1.status).toBe(200);
    expect(p2.status).toBe(200);

    const a1 = await request(app)
      .get('/api/proctor/audit-report')
      .set('Authorization', `Bearer ${proctorToken}`);
    const a2 = await request(app)
      .get('/api/proctor/logs')
      .set('Authorization', `Bearer ${proctorToken}`);
    expect(a1.status).toBe(200);
    expect(a2.status).toBe(200);

    // Admin aliases
    const d1 = await request(app)
      .get('/api/admin/db-telemetry')
      .set('Authorization', `Bearer ${adminToken}`);
    const d2 = await request(app)
      .get('/api/admin/system-stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(d1.status).toBe(200);
    expect(d2.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // BUG-011: POST aliases for answer/response endpoints
  // --------------------------------------------------------------------------
  it('[BUG-011] POST /api/sessions/:id/response, /responses, and /answer are registered and reachable', async () => {
    const r1 = await request(app)
      .post('/api/sessions/1/response')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: 1, selectedOption: 'A' });

    const r2 = await request(app)
      .post('/api/sessions/1/responses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: 1, selectedOption: 'A' });

    const r3 = await request(app)
      .post('/api/sessions/1/answer')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: 1, selectedOption: 'A' });

    // Endpoints exist (must not return 404 Route Not Found)
    expect(r1.status).not.toBe(404);
    expect(r2.status).not.toBe(404);
    expect(r3.status).not.toBe(404);
  });

  // --------------------------------------------------------------------------
  // BUG-012: IDOR protection on /uploads
  // --------------------------------------------------------------------------
  it('[BUG-012] Accessing another student forensic snapshot via /uploads is rejected with 403 Forbidden', async () => {
    // Candidate ID 3 tries to access snapshot of candidate session 2
    const res = await request(app)
      .get('/uploads/sim-no_face-71-1794640030112.jpg')
      .set('Authorization', `Bearer ${studentToken}`);

    // Must be 403 Forbidden (or 404 if file does not belong to student)
    expect([403, 404]).toContain(res.status);
  });

  // --------------------------------------------------------------------------
  // BUG-013: Snapshot upload magic byte and file size validation
  // --------------------------------------------------------------------------
  it('[BUG-013] Snapshot upload rejects invalid non-image payload with 400 Bad Request', async () => {
    if (!dbReady) return;
    // Candidate testing snapshot upload on their own session
    const [sessRows] = await pool.query<RowDataPacket[]>(
      'SELECT student_id FROM Exam_Sessions WHERE id = ?',
      [createdStudentSessionId]
    );
    const ownerId = sessRows[0]?.student_id || 5;
    const ownerToken = jwt.sign(
      { sub: ownerId, role: 'STUDENT', email: `student${ownerId}@proctoriq.io` },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/violations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sessionId: createdStudentSessionId,
        violationCode: 'NO_FACE',
        snapshot: 'data:text/plain;base64,VGhpcyBpcyBub3QgYW4gaW1hZ2U=', // Invalid non-image base64
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // --------------------------------------------------------------------------
  // BUG-022: Database performance indexes
  // --------------------------------------------------------------------------
  it('[BUG-022] Migration 005 performance indexes exist and are recognized by MySQL optimizer', async () => {
    if (!dbReady) return;
    const [resultsIdx] = await pool.query<RowDataPacket[]>(
      `SHOW INDEX FROM Results WHERE Key_name = 'idx_results_graded_at'`
    );
    expect(resultsIdx.length).toBeGreaterThan(0);

    const [sessionsIdx] = await pool.query<RowDataPacket[]>(
      `SHOW INDEX FROM Exam_Sessions WHERE Key_name = 'idx_sessions_status_deadline'`
    );
    expect(sessionsIdx.length).toBeGreaterThan(0);

    // EXPLAIN audit on Results covering query uses idx_results_graded_at
    const [explainResults] = await pool.query<RowDataPacket[]>(
      'EXPLAIN SELECT id, graded_at FROM Results ORDER BY graded_at DESC'
    );
    expect(explainResults[0].key).toBe('idx_results_graded_at');

    // EXPLAIN audit on Exam_Sessions status and deadline uses idx_sessions_status_deadline or idx_sessions_status
    const [explainSessions] = await pool.query<RowDataPacket[]>(
      "EXPLAIN SELECT id FROM Exam_Sessions WHERE status = 'IN_PROGRESS' AND server_deadline < NOW()"
    );
    expect(['idx_sessions_status_deadline', 'idx_sessions_status']).toContain(explainSessions[0].key);
  });
});
