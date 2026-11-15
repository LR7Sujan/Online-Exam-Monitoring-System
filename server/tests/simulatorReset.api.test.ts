import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { pool, queryRows } from '../src/config/db.js';
import { simulatorEngine } from '../src/services/simulator.js';

describe('Simulator Reset API & Database Cleanup Invariant Tests', () => {
  const app = createApp();

  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // 2. Proctor login
    const proctorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(proctorRes.status).toBe(200);
    proctorToken = proctorRes.body.data.token;

    // 3. Student login
    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(studentRes.status).toBe(200);
    studentToken = studentRes.body.data.token;
  });

  afterAll(async () => {
    if (simulatorEngine.getState().isRunning) {
      await simulatorEngine.stop();
    }
    await pool.end();
  });

  it('1. POST /api/simulator/reset enforces authentication and admin role (401 / 403)', async () => {
    // 401 when unauthenticated
    const noAuth = await request(app).post('/api/simulator/reset');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.success).toBe(false);

    // 403 when student
    const studentReq = await request(app)
      .post('/api/simulator/reset')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentReq.status).toBe(403);
    expect(studentReq.body.success).toBe(false);

    // 403 when proctor
    const proctorReq = await request(app)
      .post('/api/simulator/reset')
      .set('Authorization', `Bearer ${proctorToken}`);
    expect(proctorReq.status).toBe(403);
    expect(proctorReq.body.success).toBe(false);
  });

  it('2. POST /api/simulator/reset deletes only simulated rows and preserves all real data', async () => {
    // Count real database entities before simulation
    const [realUsersBefore] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Users WHERE email NOT LIKE 'virtual.candidate.%'"
    );
    const [realSessionsBefore] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Exam_Sessions es JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );
    const [realLogsBefore] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Proctoring_Logs pl JOIN Exam_Sessions es ON es.id = pl.session_id JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );
    const [realResponsesBefore] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Student_Responses sr JOIN Exam_Sessions es ON es.id = sr.session_id JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );
    const [realResultsBefore] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Results r JOIN Exam_Sessions es ON es.id = r.session_id JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );

    // Launch simulation with 4 virtual students at high speed and high chaos
    await simulatorEngine.start({
      examId: 1,
      studentCount: 4,
      speed: 5.0,
      chaos: 'high',
    });

    // Wait 1.5 seconds for ticks to execute answers & infractions
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify virtual examinees exist in the database
    const [simUsersCount] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Users WHERE email LIKE 'virtual.candidate.%'"
    );
    expect(Number(simUsersCount.cnt)).toBeGreaterThanOrEqual(4);

    // Execute reset endpoint as admin
    const resetRes = await request(app)
      .post('/api/simulator/reset')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.data).toHaveProperty('deletedSessions');
    expect(resetRes.body.data).toHaveProperty('deletedUsers');
    expect(resetRes.body.data).toHaveProperty('deletedLogs');
    expect(resetRes.body.data).toHaveProperty('deletedResponses');
    expect(resetRes.body.data).toHaveProperty('deletedResults');

    expect(resetRes.body.data.deletedSessions).toBeGreaterThanOrEqual(4);
    expect(resetRes.body.data.deletedUsers).toBeGreaterThanOrEqual(4);

    // Verify virtual examinees are completely cleared
    const [simUsersAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Users WHERE email LIKE 'virtual.candidate.%'"
    );
    expect(Number(simUsersAfter.cnt)).toBe(0);

    const [simSessionsAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Exam_Sessions es JOIN Users u ON u.id = es.student_id WHERE u.email LIKE 'virtual.candidate.%'"
    );
    expect(Number(simSessionsAfter.cnt)).toBe(0);

    // Verify in-memory engine is stopped and cleared
    const engineState = simulatorEngine.getState();
    expect(engineState.isRunning).toBe(false);
    expect(engineState.candidates.length).toBe(0);
    expect(engineState.activityLogs.length).toBe(0);
    expect(engineState.stats.activeCount).toBe(0);
    expect(engineState.stats.answersCount).toBe(0);

    // Invariant: Count real database entities after reset - MUST BE EQUAL
    const [realUsersAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Users WHERE email NOT LIKE 'virtual.candidate.%'"
    );
    const [realSessionsAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Exam_Sessions es JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );
    const [realLogsAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Proctoring_Logs pl JOIN Exam_Sessions es ON es.id = pl.session_id JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );
    const [realResponsesAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Student_Responses sr JOIN Exam_Sessions es ON es.id = sr.session_id JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );
    const [realResultsAfter] = await queryRows<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM Results r JOIN Exam_Sessions es ON es.id = r.session_id JOIN Users u ON u.id = es.student_id WHERE u.email NOT LIKE 'virtual.candidate.%'"
    );

    expect(Number(realUsersAfter.cnt)).toBe(Number(realUsersBefore.cnt));
    expect(Number(realSessionsAfter.cnt)).toBe(Number(realSessionsBefore.cnt));
    expect(Number(realLogsAfter.cnt)).toBe(Number(realLogsBefore.cnt));
    expect(Number(realResponsesAfter.cnt)).toBe(Number(realResponsesBefore.cnt));
    expect(Number(realResultsAfter.cnt)).toBe(Number(realResultsBefore.cnt));
  });

  it('3. POST /api/simulator/reset is idempotent and returns 0 deleted counts on repeated calls', async () => {
    const secondCall = await request(app)
      .post('/api/simulator/reset')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(secondCall.status).toBe(200);
    expect(secondCall.body.success).toBe(true);
    expect(secondCall.body.data).toEqual({
      deletedLogs: 0,
      deletedResponses: 0,
      deletedResults: 0,
      deletedSessions: 0,
      deletedUsers: 0,
    });

    // Also verify alias route POST /api/admin/simulator/reset
    const aliasCall = await request(app)
      .post('/api/admin/simulator/reset')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(aliasCall.status).toBe(200);
    expect(aliasCall.body.success).toBe(true);
    expect(aliasCall.body.data).toEqual({
      deletedLogs: 0,
      deletedResponses: 0,
      deletedResults: 0,
      deletedSessions: 0,
      deletedUsers: 0,
    });
  });

  it('4. SQL Invariant: Proctoring_Logs delete protection trigger still blocks direct DELETE on real logs', async () => {
    // Pick the first existing real log ID
    const [firstLog] = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Proctoring_Logs ORDER BY id ASC LIMIT 1'
    );
    expect(firstLog).toBeDefined();
    const logId = firstLog.id;

    // Attempting direct DELETE on Proctoring_Logs must trigger trg_before_log_delete
    let thrownError: Error | null = null;
    try {
      await pool.query('DELETE FROM Proctoring_Logs WHERE id = ?', [logId]);
    } catch (err: unknown) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain('Proctoring_Logs is immutable: violation records cannot be deleted.');

    // Verify row was not deleted
    const [checkLog] = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Proctoring_Logs WHERE id = ?',
      [logId]
    );
    expect(checkLog).toBeDefined();
    expect(checkLog.id).toBe(logId);
  });
});
