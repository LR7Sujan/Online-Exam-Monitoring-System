import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import type Pusher from 'pusher';
import { createApp } from '../src/app.js';
import { pool, executeSql, testDbConnection } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import {
  PusherRealtimeAdapter,
  PollingRealtimeAdapter,
  setRealtimeAdapter,
  purgeOldEvents,
  emitViolationNew,
  emitWarningIssued,
  emitExtensionDecided,
  emitSessionTerminated,
} from '../src/realtime/index.js';

function makeToken(payload: { sub: number; email: string; role: 'STUDENT' | 'PROCTOR' | 'ADMIN'; fullName: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Serverless Realtime Layer: Polling & Pusher Providers', () => {
  let server: HttpServer;
  let serverOrigin: string;
  let dbAvailable = false;

  let adminToken: string;
  let proctorToken: string;
  let student1Token: string;
  let student2Token: string;

  const student1Id = 8801;
  const student2Id = 8802;
  const proctorId = 8800;
  const examId = 880;
  const session1Id = 88001;
  const session2Id = 88002;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4001;
    serverOrigin = `http://localhost:${port}`;

    adminToken = makeToken({ sub: 1, email: 'admin@proctoriq.io', role: 'ADMIN', fullName: 'Dr. Elena Vance' });
    proctorToken = makeToken({ sub: proctorId, email: 'proctor@proctoriq.io', role: 'PROCTOR', fullName: 'Marcus Sterling' });
    student1Token = makeToken({ sub: student1Id, email: 's1@proctoriq.io', role: 'STUDENT', fullName: 'Student One' });
    student2Token = makeToken({ sub: student2Id, email: 's2@proctoriq.io', role: 'STUDENT', fullName: 'Student Two' });

    dbAvailable = await testDbConnection();
    if (dbAvailable) {
      try {
        await executeSql('INSERT IGNORE INTO Users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [
          proctorId,
          'proctor88@proctoriq.io',
          'hash',
          'Marcus Sterling',
          'PROCTOR',
        ]);
        await executeSql('INSERT IGNORE INTO Users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [
          student1Id,
          's1@proctoriq.io',
          'hash',
          'Student One',
          'STUDENT',
        ]);
        await executeSql('INSERT IGNORE INTO Users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [
          student2Id,
          's2@proctoriq.io',
          'hash',
          'Student Two',
          'STUDENT',
        ]);

        await executeSql(
          'INSERT IGNORE INTO Exams (id, title, duration_minutes, min_trust_score, created_by) VALUES (?, ?, ?, ?, ?)',
          [examId, 'Realtime Provider Test Exam', 60, 50, 1]
        );

        await executeSql(
          `INSERT IGNORE INTO Exam_Sessions (id, exam_id, student_id, trust_score, status, started_at, server_deadline)
           VALUES (?, ?, ?, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE))`,
          [session1Id, examId, student1Id]
        );
        await executeSql(
          `INSERT IGNORE INTO Exam_Sessions (id, exam_id, student_id, trust_score, status, started_at, server_deadline)
           VALUES (?, ?, ?, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE))`,
          [session2Id, examId, student2Id]
        );
      } catch (err) {
        console.warn('[RealtimeTest] Setup insert warning:', err);
      }
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      try {
        await executeSql('DELETE FROM Exam_Sessions WHERE id IN (?, ?)', [session1Id, session2Id]);
        await executeSql('DELETE FROM Exams WHERE id = ?', [examId]);
        await executeSql('DELETE FROM Users WHERE id IN (?, ?, ?)', [proctorId, student1Id, student2Id]);
        await executeSql('DELETE FROM Events WHERE channel LIKE "private-%"');
      } catch {
        // ignore teardown error
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setRealtimeAdapter(null);
  });

  // ==========================================================================
  // 1. Channel Authorization Gate (POST /api/realtime/auth)
  // ==========================================================================
  describe('Channel Authorization Gate (/api/realtime/auth)', () => {
    it('allows Proctor to subscribe to private-role-proctor', async () => {
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proctorToken}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: 'private-role-proctor' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.auth).toBeDefined();
    });

    it('rejects Student attempting to subscribe to private-role-proctor (403)', async () => {
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: 'private-role-proctor' }),
      });
      expect(res.status).toBe(403);
    });

    it('rejects Proctor attempting to subscribe to private-role-admin (403)', async () => {
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proctorToken}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: 'private-role-admin' }),
      });
      expect(res.status).toBe(403);
    });

    it('allows Admin to subscribe to private-role-admin', async () => {
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: 'private-role-admin' }),
      });
      expect(res.status).toBe(200);
    });

    it('allows Student to subscribe to their own user channel', async () => {
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: `private-user-${student1Id}` }),
      });
      expect(res.status).toBe(200);
    });

    it('rejects Student attempting to subscribe to another student user channel (403)', async () => {
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: `private-user-${student2Id}` }),
      });
      expect(res.status).toBe(403);
    });

    it('allows Student to subscribe to their own session channel', async () => {
      if (!dbAvailable) return;
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: `private-session-${session1Id}` }),
      });
      expect(res.status).toBe(200);
    });

    it('rejects Student attempting to subscribe to another student session channel (403)', async () => {
      if (!dbAvailable) return;
      const res = await fetch(`${serverOrigin}/api/realtime/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ socket_id: '1234.5678', channel_name: `private-session-${session2Id}` }),
      });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // 2. Polling Provider & Events Table Fallback (GET /api/events)
  // ==========================================================================
  describe('Polling Fallback Provider (MySQL Events Table)', () => {
    beforeAll(() => {
      setRealtimeAdapter(new PollingRealtimeAdapter());
    });

    it('delivers student violation event to proctor stream within 3 seconds', async () => {
      const t0 = Date.now();

      // Baseline cursor
      const initRes = await fetch(`${serverOrigin}/api/events?since=0`, {
        headers: { Authorization: `Bearer ${proctorToken}` },
      }).then((r) => r.json());
      const cursor0 = initRes.data?.cursor ?? 0;

      // Trigger a violation publication
      emitViolationNew(
        student1Id,
        session1Id,
        {
          sessionId: session1Id,
          studentName: 'Student One',
          violationCode: 'PHONE_DETECTED',
          penaltyApplied: 30,
        },
        {
          sessionId: session1Id,
          trust_score: 70,
          status: 'IN_PROGRESS',
        }
      );

      // Poll as proctor
      const pollRes = await fetch(`${serverOrigin}/api/events?since=${cursor0}`, {
        headers: { Authorization: `Bearer ${proctorToken}` },
      }).then((r) => r.json());

      const elapsedMs = Date.now() - t0;
      expect(elapsedMs).toBeLessThan(3000); // Delivered in < 3s

      const events = pollRes.data?.events ?? [];
      const foundViolation = events.find((e: { type: string; channel: string }) => e.type === 'violation:new');
      expect(foundViolation).toBeDefined();
      expect(foundViolation.channel).toBe('private-role-proctor');
      expect(foundViolation.payload.violationCode).toBe('PHONE_DETECTED');
    });

    it('ensures students receive only their own events and never proctor channels', async () => {
      // Baseline cursor
      const baseRes = await fetch(`${serverOrigin}/api/events?since=0`, {
        headers: { Authorization: `Bearer ${student1Token}` },
      }).then((r) => r.json());
      const cursor = baseRes.data?.cursor ?? 0;

      // Publish violation for Student 1
      emitViolationNew(
        student1Id,
        session1Id,
        {
          sessionId: session1Id,
          violationCode: 'LOOK_AWAY',
          penaltyApplied: 10,
        },
        {
          sessionId: session1Id,
          trust_score: 90,
          status: 'IN_PROGRESS',
        }
      );

      // Student 1 polls: receives their own violation:logged update
      const s1Res = await fetch(`${serverOrigin}/api/events?since=${cursor}`, {
        headers: { Authorization: `Bearer ${student1Token}` },
      }).then((r) => r.json());
      const s1Events = s1Res.data?.events ?? [];
      const s1Logged = s1Events.find((e: { type: string }) => e.type === 'violation:logged');
      expect(s1Logged).toBeDefined();
      expect(s1Logged.payload.violationCode).toBe('LOOK_AWAY');

      // Verify Student 1 did NOT receive the proctor-only violation:new on private-role-proctor
      const leakedProctorEvent = s1Events.find((e: { channel: string }) => e.channel === 'private-role-proctor');
      expect(leakedProctorEvent).toBeUndefined();

      // Student 2 polls: receives ZERO events from Student 1
      const s2Res = await fetch(`${serverOrigin}/api/events?since=${cursor}`, {
        headers: { Authorization: `Bearer ${student2Token}` },
      }).then((r) => r.json());
      expect(s2Res.data?.events?.length ?? 0).toBe(0);
    });

    it('rejects unauthorized channel requests on polling endpoint', async () => {
      // Student 2 explicitly requests proctor channel
      const res = await fetch(`${serverOrigin}/api/events?channels=private-role-proctor`, {
        headers: { Authorization: `Bearer ${student2Token}` },
      });
      expect(res.status).toBe(403);
    });

    it('purges events older than 10 minutes from Events table', async () => {
      if (!dbAvailable) return;
      // Insert an expired event manually
      await executeSql(
        `INSERT INTO Events (channel, type, payload, created_at)
         VALUES ('private-role-proctor', 'old_event', '{"test":true}', DATE_SUB(NOW(), INTERVAL 15 MINUTE))`
      );

      // Force purge
      await purgeOldEvents(true);

      const oldRows = await pool.query(
        "SELECT event_id FROM Events WHERE type = 'old_event'"
      );
      const rows = (oldRows[0] as unknown[]) ?? [];
      expect(rows.length).toBe(0);
    });
  });

  // ==========================================================================
  // 3. Pusher Provider (Mocked Publisher)
  // ==========================================================================
  describe('Pusher Channels Provider (Mocked Publisher)', () => {
    let triggeredCalls: { channel: string; event: string; data: unknown }[] = [];
    let pusherAdapter: PusherRealtimeAdapter;

    beforeAll(() => {
      pusherAdapter = new PusherRealtimeAdapter();
      triggeredCalls = [];

      const mockPusherClient = {
        trigger: async (channel: string, event: string, data: unknown) => {
          triggeredCalls.push({ channel, event, data });
        },
        authorizeChannel: (socketId: string, channel: string) => {
          return { auth: `mock-key:${socketId}:${channel}` };
        },
      } as unknown as Pusher;

      pusherAdapter.setPusherClient(mockPusherClient);
      setRealtimeAdapter(pusherAdapter);
    });

    it('delivers student violation to proctor within 1 second via Pusher', async () => {
      triggeredCalls = [];
      const t0 = Date.now();

      emitViolationNew(
        student1Id,
        session1Id,
        {
          sessionId: session1Id,
          studentName: 'Student One',
          violationCode: 'MULTIPLE_FACES',
          penaltyApplied: 25,
        },
        {
          sessionId: session1Id,
          trust_score: 75,
          status: 'IN_PROGRESS',
        }
      );

      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(1000); // Instant dispatch < 1s

      // Verify proctor channel received violation:new
      const proctorEvent = triggeredCalls.find(
        (c) => c.channel === 'private-role-proctor' && c.event === 'violation:new'
      );
      expect(proctorEvent).toBeDefined();
      expect((proctorEvent?.data as Record<string, unknown>).violationCode).toBe('MULTIPLE_FACES');

      // Verify student channel received violation:logged
      const studentEvent = triggeredCalls.find(
        (c) => c.channel === `private-user-${student1Id}` && c.event === 'violation:logged'
      );
      expect(studentEvent).toBeDefined();
      expect((studentEvent?.data as Record<string, unknown>).violationCode).toBe('MULTIPLE_FACES');
    });

    it('triggers warning:issued, extension:decided, and session:terminated events correctly', async () => {
      triggeredCalls = [];

      // 1. Warning issued
      emitWarningIssued(student1Id, session1Id, { warningId: 101, message: 'Quiet please' });
      expect(triggeredCalls.some((c) => c.channel === 'private-role-proctor' && c.event === 'warning:issued')).toBe(true);
      expect(triggeredCalls.some((c) => c.channel === `private-user-${student1Id}` && c.event === 'warning:issued')).toBe(true);

      // 2. Extension decided
      emitExtensionDecided(student1Id, session1Id, { status: 'APPROVED', minutesGranted: 10 });
      expect(triggeredCalls.some((c) => c.channel === 'private-role-proctor' && c.event === 'extension:decided')).toBe(true);
      expect(triggeredCalls.some((c) => c.channel === `private-user-${student1Id}` && c.event === 'extension:decided')).toBe(true);

      // 3. Session terminated
      emitSessionTerminated(
        student1Id,
        session1Id,
        { sessionId: session1Id, studentName: 'Student One', status: 'TERMINATED_CHEATING' },
        { sessionId: session1Id, trust_score: 40, status: 'TERMINATED_CHEATING' }
      );
      expect(triggeredCalls.some((c) => c.channel === 'private-role-proctor' && c.event === 'session:terminated')).toBe(true);
      expect(triggeredCalls.some((c) => c.channel === `private-user-${student1Id}` && c.event === 'session:terminated')).toBe(true);
    });

    it('never throws or breaks caller if Pusher trigger encounters a network failure', async () => {
      const failingClient = {
        trigger: async () => {
          throw new Error('Pusher network timeout 504');
        },
      } as unknown as Pusher;
      pusherAdapter.setPusherClient(failingClient);

      // Should not throw
      expect(() => {
        emitViolationNew(
          student1Id,
          session1Id,
          { violationCode: 'FAIL_TEST' },
          { sessionId: session1Id, trust_score: 99, status: 'IN_PROGRESS' }
        );
      }).not.toThrow();
    });
  });
});
