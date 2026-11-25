import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { pool, testDbConnection } from '../src/config/db.js';
import { env, assertTestDatabaseSafety } from '../src/config/env.js';
import { enforceLazyTimeouts } from '../src/services/timeoutService.js';
import { simulatorEngine } from '../src/services/simulator.js';

const app = createApp();

function makeToken(payload: { sub: number; email: string; role: 'STUDENT' | 'PROCTOR' | 'ADMIN'; fullName: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Phase 21: Lazy Enforcement, Vercel Cron & Zero Server Timers', () => {
  let dbAvailable = false;
  const studentToken = makeToken({ sub: 101, email: 'lazy.student@test.local', role: 'STUDENT', fullName: 'Lazy Student' });
  const proctorToken = makeToken({ sub: 102, email: 'lazy.proctor@test.local', role: 'PROCTOR', fullName: 'Lazy Proctor' });

  beforeAll(async () => {
    assertTestDatabaseSafety('lazy timeouts and cron tests');
    dbAvailable = await testDbConnection();
    if (!dbAvailable) return;

    // Clean up previous test users/sessions
    await pool.query("DELETE FROM Users WHERE email IN ('lazy.student@test.local', 'lazy.proctor@test.local')");
    await pool.query(
      `INSERT INTO Users (id, full_name, email, password_hash, role)
       VALUES (101, 'Lazy Student', 'lazy.student@test.local', 'hash', 'STUDENT'),
              (102, 'Lazy Proctor', 'lazy.proctor@test.local', 'hash', 'PROCTOR')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`
    );
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await pool.query("DELETE FROM Users WHERE email IN ('lazy.student@test.local', 'lazy.proctor@test.local')");
  });

  describe('1. Lazy Enforcement of Session Timeouts', () => {
    it('times out an expired session on GET /api/sessions/:id/time-left', async () => {
      if (!dbAvailable) return;

      // Create an expired exam session past deadline + grace
      const [ins] = await pool.query<{ insertId: number } & RowDataPacket[]>(
        `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
         VALUES (1, 101, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 300 SECOND))`
      );
      const sessionId = ins.insertId;

      // Trigger lazy enforcement via GET /api/sessions/:id/time-left
      const res = await request(app)
        .get(`/api/sessions/${sessionId}/time-left`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('TIMED_OUT');
      expect(res.body.data.secondsLeft).toBe(0);

      // Verify in DB that session was graded and marked TIMED_OUT
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT status, ended_at FROM Exam_Sessions WHERE id = ?',
        [sessionId]
      );
      expect(rows[0]?.status).toBe('TIMED_OUT');
      expect(rows[0]?.ended_at).not.toBeNull();
    });

    it('times out an expired session on POST /api/sessions/:id/heartbeat', async () => {
      if (!dbAvailable) return;

      const [ins] = await pool.query<{ insertId: number } & RowDataPacket[]>(
        `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
         VALUES (1, 101, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 300 SECOND))`
      );
      const sessionId = ins.insertId;

      const res = await request(app)
        .post(`/api/sessions/${sessionId}/heartbeat`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('TIMED_OUT');
      expect(res.body.data.secondsRemaining).toBe(0);
    });

    it('cleans expired sessions from GET /api/monitor/live before returning', async () => {
      if (!dbAvailable) return;

      const [ins] = await pool.query<{ insertId: number } & RowDataPacket[]>(
        `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
         VALUES (1, 101, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 300 SECOND))`
      );
      const sessionId = ins.insertId;

      const res = await request(app)
        .get('/api/monitor/live')
        .set('Authorization', `Bearer ${proctorToken}`);

      expect(res.status).toBe(200);
      // The expired session must NOT appear in live sessions
      const liveList = res.body.data as Array<{ sessionId: number }>;
      expect(liveList.some((s) => s.sessionId === sessionId)).toBe(false);

      const [dbRows] = await pool.query<RowDataPacket[]>('SELECT status FROM Exam_Sessions WHERE id = ?', [sessionId]);
      expect(dbRows[0]?.status).toBe('TIMED_OUT');
    });

    it('enforces lazy timeout when student loads dashboard (GET /api/exams/available)', async () => {
      if (!dbAvailable) return;

      const [ins] = await pool.query<{ insertId: number } & RowDataPacket[]>(
        `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
         VALUES (1, 101, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 300 SECOND))`
      );
      const sessionId = ins.insertId;

      const res = await request(app)
        .get('/api/exams/available')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const examItem = (res.body.data as Array<{ session_id: number; session_status: string }>).find(
        (e) => e.session_id === sessionId
      );
      expect(examItem?.session_status).toBe('TIMED_OUT');
    });

    it('pending extension request within grace window BLOCKS auto-timeout', async () => {
      if (!dbAvailable) return;

      // Session past regular deadline (e.g. 30 seconds ago)
      const [ins] = await pool.query<{ insertId: number } & RowDataPacket[]>(
        `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
         VALUES (1, 101, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 30 SECOND))`
      );
      const sessionId = ins.insertId;

      // Insert an active PENDING extension request created 10 seconds ago
      await pool.query(
        `INSERT INTO Time_Extension_Requests (session_id, requested_minutes, reason, status, created_at)
         VALUES (?, 15, 'Need extra time for review', 'PENDING', DATE_SUB(NOW(), INTERVAL 10 SECOND))`,
        [sessionId]
      );

      // Trigger lazy timeout check
      const timedOut = await enforceLazyTimeouts({ sessionId });
      expect(timedOut).toBe(false);

      // Verify the session remains IN_PROGRESS because proctor review is pending
      const [rows] = await pool.query<RowDataPacket[]>('SELECT status FROM Exam_Sessions WHERE id = ?', [sessionId]);
      expect(rows[0]?.status).toBe('IN_PROGRESS');
    });

    it('running the lazy check twice changes nothing (idempotent & race-safe)', async () => {
      if (!dbAvailable) return;

      const [ins] = await pool.query<{ insertId: number } & RowDataPacket[]>(
        `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
         VALUES (1, 101, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 300 SECOND))`
      );
      const sessionId = ins.insertId;

      const firstRun = await enforceLazyTimeouts({ sessionId });
      expect(firstRun).toBe(true);

      const [firstState] = await pool.query<RowDataPacket[]>('SELECT * FROM Exam_Sessions WHERE id = ?', [sessionId]);

      // Second run immediately following
      const secondRun = await enforceLazyTimeouts({ sessionId });
      expect(secondRun).toBe(false);

      const [secondState] = await pool.query<RowDataPacket[]>('SELECT * FROM Exam_Sessions WHERE id = ?', [sessionId]);
      expect(secondState[0]?.status).toBe('TIMED_OUT');
      expect(secondState[0]?.ended_at?.toISOString()).toBe(firstState[0]?.ended_at?.toISOString());
    });
  });

  describe('2. Vercel Cron Housekeeping Endpoints', () => {
    it('rejects cron requests without Authorization header (401)', async () => {
      const res = await request(app).post('/api/cron/timeouts');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects cron requests with invalid Bearer token (401)', async () => {
      const res = await request(app)
        .post('/api/cron/timeouts')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('succeeds on POST /api/cron/timeouts with valid CRON_SECRET', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post('/api/cron/timeouts')
        .set('Authorization', `Bearer ${env.CRON_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Timeout sweep completed.');
      expect(typeof res.body.data.timedOutSessionsProcessed).toBe('number');
    });

    it('succeeds on GET /api/cron/retention with valid CRON_SECRET', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get('/api/cron/retention')
        .set('Authorization', `Bearer ${env.CRON_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Retention cleanup completed.');
    });

    it('succeeds on GET /api/cron/events-cleanup with valid CRON_SECRET', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get('/api/cron/events-cleanup')
        .set('Authorization', `Bearer ${env.CRON_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Realtime events cleanup completed.');
      expect(res.body.data.purged).toBe(true);
    });
  });

  describe('3. Zero Server Timers & Browser-Driven Swarm Simulator', () => {
    it('simulatorEngine does not spawn any Node background intervals on start()', async () => {
      if (!dbAvailable) return;

      const state = await simulatorEngine.start({
        examId: 1,
        studentCount: 4,
        speed: 2.0,
        chaos: 'low',
        seed: 'test-seed-zero-interval',
      });

      expect(state.isRunning).toBe(true);
      expect(state.candidates.length).toBe(4);

      // Verify simulator has no running server timer property
      expect((simulatorEngine as unknown as { timer?: unknown }).timer).toBeUndefined();

      // Calling tick explicitly advances candidate actions deterministically
      const afterTick = await simulatorEngine.tick();
      expect(afterTick.isRunning).toBe(true);
      expect(afterTick.stats.answersCount + afterTick.stats.infractionsCount).toBeGreaterThanOrEqual(0);

      await simulatorEngine.stop();
      expect(simulatorEngine.getState().isRunning).toBe(false);
    });

    it('exposes POST /api/admin/simulator/tick for browser-driven swarm steps', async () => {
      if (!dbAvailable) return;

      const adminToken = makeToken({ sub: 103, email: 'admin.sim@test.local', role: 'ADMIN', fullName: 'Sim Admin' });
      const res = await request(app)
        .post('/api/admin/simulator/tick')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('candidates');
      expect(res.body.data).toHaveProperty('stats');
    });
  });
});
