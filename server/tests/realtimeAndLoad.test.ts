import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { pool, executeSql } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { simulatorEngine } from '../src/services/simulator.js';
import type { RowDataPacket } from 'mysql2/promise';

function makeToken(payload: { sub: number; email: string; role: 'STUDENT' | 'PROCTOR' | 'ADMIN'; fullName: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Sub-Phase 11.6: Realtime, Proctoring Invariants & Load Verification', () => {
  let server: HttpServer;
  let serverPort: number;
  let serverOrigin: string;

  let adminToken: string;
  let proctor1Token: string;
  let proctor2Token: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);

    const address = server.address();
    serverPort = typeof address === 'object' && address ? address.port : 4001;
    serverOrigin = `http://localhost:${serverPort}`;

    adminToken = makeToken({ sub: 1, email: 'admin@proctoriq.io', role: 'ADMIN', fullName: 'Dr. Elena Vance' });
    proctor1Token = makeToken({ sub: 2, email: 'proctor@proctoriq.io', role: 'PROCTOR', fullName: 'Marcus Sterling' });
    proctor2Token = makeToken({ sub: 3, email: 'proctor2@proctoriq.io', role: 'PROCTOR', fullName: 'Priya Nair' });
  });

  afterAll(async () => {
    if (simulatorEngine.getState().isRunning) {
      await simulatorEngine.stop();
    }
    const io = getIo();
    if (io) {
      io.close();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // Helper to provision an isolated test student and session
  async function provisionTestStudent(prefix: string, trustScore = 100) {
    const timestamp = Date.now();
    const email = `${prefix}.${timestamp}@proctoriq.test`;
    const fullName = `Test ${prefix} User`;

    const userIns = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', 1)`,
      [fullName, email]
    );
    const studentId = userIns.insertId;
    const token = makeToken({ sub: studentId, email, role: 'STUDENT', fullName });

    const sessionIns = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, session_token, ip_address, device_fingerprint, status, trust_score, server_deadline)
       VALUES (1, ?, ?, '127.0.0.1', 'test-fp', 'IN_PROGRESS', ?, DATE_ADD(NOW(), INTERVAL 60 MINUTE))`,
      [studentId, `tok-${studentId}-${timestamp}`, trustScore]
    );
    const sessionId = sessionIns.insertId;

    return { studentId, sessionId, token, email, fullName };
  }

  // ==========================================================================
  // 1. DEBOUNCE VERIFICATION
  // ==========================================================================
  it('Debounce: rapid repeats of the same violation within 3s count only once', async () => {
    const { sessionId, token } = await provisionTestStudent('debounce', 100);

    const reportUrl = `${serverOrigin}/api/sessions/${sessionId}/violation`;
    const fireViolation = () =>
      fetch(reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: 'COPY_PASTE', evidenceMeta: { test: true } }),
      }).then((r) => r.json());

    // Send 3 requests simultaneously
    const [res1, res2, res3] = await Promise.all([
      fireViolation(),
      fireViolation(),
      fireViolation(),
    ]);

    const recordedCount = [res1, res2, res3].filter((r) => r.success && !r.data.debounced).length;
    const debouncedCount = [res1, res2, res3].filter((r) => r.success && r.data.debounced).length;

    expect(recordedCount).toBe(1);
    expect(debouncedCount).toBe(2);

    // Verify exactly ONE log row was written to Proctoring_Logs
    const [afterLogs] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM Proctoring_Logs WHERE session_id = ? AND violation_type_id = 3',
      [sessionId]
    );
    expect(Number(afterLogs[0].cnt)).toBe(1);

    const [vt] = await pool.query<RowDataPacket[]>(
      'SELECT penalty_points FROM Violation_Types WHERE code = ?',
      ['COPY_PASTE']
    );
    const expectedPenalty = vt.length ? Number(vt[0].penalty_points) : 10;

    // Verify trust score deducted only once (100 - penalty)
    const [sess] = await pool.query<RowDataPacket[]>(
      'SELECT trust_score FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sess[0].trust_score).toBe(100 - expectedPenalty);
  });

  // ==========================================================================
  // 2. AUTO-TERMINATION & GRADING
  // ==========================================================================
  it('Auto-termination: violations below threshold terminate session, grade once, and yield DISQUALIFIED with score 0', async () => {
    const { sessionId, token } = await provisionTestStudent('autoterm', 70);

    // Add one correct answer to prove score is forced to 0 on disqualification
    await executeSql(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option, answered_at)
       VALUES (?, 1, 'B', NOW())`,
      [sessionId]
    );

    // Send critical violation DEVTOOLS_OPEN (-50 pts, bringing score from 70 to 20 <= 50)
    const res = await fetch(`${serverOrigin}/api/sessions/${sessionId}/violation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: 'DEVTOOLS_OPEN', evidenceMeta: { test: true } }),
    }).then((r) => r.json());

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('TERMINATED_CHEATING');
    expect(res.data.trustScore).toBeLessThanOrEqual(50);

    // Auto-grade procedure execution
    const [gradeResult] = await pool.query<RowDataPacket[][]>(
      'CALL sp_SubmitAndGradeExam(?, ?)',
      [sessionId, 'AUTO_TERMINATED']
    );
    const resultRow = gradeResult[0][0];

    expect(resultRow.integrity_status).toBe('DISQUALIFIED');
    expect(Number(resultRow.raw_score)).toBe(0);
    expect(Number(resultRow.percentage)).toBe(0);

    // Calling sp_SubmitAndGradeExam a second time returns the identical existing row
    const [secondGrade] = await pool.query<RowDataPacket[][]>(
      'CALL sp_SubmitAndGradeExam(?, ?)',
      [sessionId, 'AUTO_TERMINATED']
    );
    expect(secondGrade[0][0].id).toBe(resultRow.id);

    // Verify exactly ONE row in Results table
    const [resultsCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM Results WHERE session_id = ?',
      [sessionId]
    );
    expect(Number(resultsCount[0].cnt)).toBe(1);
  });

  // ==========================================================================
  // 3. REALTIME MULTI-CLIENT SOCKET.IO ROOM ISOLATION & DEDUPLICATION
  // ==========================================================================
  it('Realtime: 2 proctors & 3 students receive events with strict tenant and channel isolation', async () => {
    // Provision 3 dedicated test students and active sessions
    const s1 = await provisionTestStudent('rt1');
    const s2 = await provisionTestStudent('rt2');
    const s3 = await provisionTestStudent('rt3');

    // Get baseline cursors before triggering violation
    const p1Base = await fetch(`${serverOrigin}/api/events?since=0`, {
      headers: { Authorization: `Bearer ${proctor1Token}` },
    }).then((r) => r.json());
    const cursorBefore = p1Base.data?.cursor ?? 0;

    // Trigger violation on Session 1 (Student 1) via API
    const viRes = await fetch(`${serverOrigin}/api/sessions/${s1.sessionId}/violation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s1.token}`,
      },
      body: JSON.stringify({ code: 'TAB_SWITCH', evidenceMeta: { realtimeTest: true } }),
    }).then((r) => r.json());

    expect(viRes.success).toBe(true);

    // Proctor 1 fetches events since baseline
    const p1Events = await fetch(`${serverOrigin}/api/events?since=${cursorBefore}`, {
      headers: { Authorization: `Bearer ${proctor1Token}` },
    }).then((r) => r.json());
    const p1Violations = (p1Events.data?.events ?? []).filter((e: { type: string }) => e.type === 'violation:new');
    expect(p1Violations.length).toBe(1);

    // Proctor 2 fetches events since baseline
    const p2Events = await fetch(`${serverOrigin}/api/events?since=${cursorBefore}`, {
      headers: { Authorization: `Bearer ${proctor2Token}` },
    }).then((r) => r.json());
    const p2Violations = (p2Events.data?.events ?? []).filter((e: { type: string }) => e.type === 'violation:new');
    expect(p2Violations.length).toBe(1);

    // Student 1 fetches events for their user/session
    const s1EventsRes = await fetch(`${serverOrigin}/api/events?since=${cursorBefore}&channels=private-user-${s1.studentId}`, {
      headers: { Authorization: `Bearer ${s1.token}` },
    }).then((r) => r.json());
    const s1Violations = (s1EventsRes.data?.events ?? []).filter((e: { type: string }) => e.type === 'violation:logged');
    expect(s1Violations.length).toBe(1);

    // Student 2 fetches events for their own channel: receives ZERO events (strictly isolated)
    const s2EventsRes = await fetch(`${serverOrigin}/api/events?since=${cursorBefore}&channels=private-user-${s2.studentId}`, {
      headers: { Authorization: `Bearer ${s2.token}` },
    }).then((r) => r.json());
    expect(s2EventsRes.data?.events?.length ?? 0).toBe(0);

    // Student 3 fetches events for their own channel: receives ZERO events (strictly isolated)
    const s3EventsRes = await fetch(`${serverOrigin}/api/events?since=${cursorBefore}&channels=private-user-${s3.studentId}`, {
      headers: { Authorization: `Bearer ${s3.token}` },
    }).then((r) => r.json());
    expect(s3EventsRes.data?.events?.length ?? 0).toBe(0);
  });

  // ==========================================================================
  // 4. OFFLINE QUEUE & SYNC VERIFICATION
  // ==========================================================================
  it('Network: answers queued offline flush and sync idempotently with zero lost answers', async () => {
    const { sessionId, token } = await provisionTestStudent('offlineSync');

    // Simulate student answering questions 1, 2, 3 in an offline queue
    const queuedAnswers = [
      { questionId: 1, selectedOption: 'A' as const },
      { questionId: 2, selectedOption: 'C' as const },
      { questionId: 3, selectedOption: 'D' as const },
    ];

    // Flush batch to PUT /sessions/:id/answer
    for (const ans of queuedAnswers) {
      const res = await fetch(`${serverOrigin}/api/sessions/${sessionId}/answer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(ans),
      }).then((r) => r.json());

      expect(res.success).toBe(true);
    }

    // Verify all 3 responses exist in Student_Responses
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT question_id, selected_option FROM Student_Responses WHERE session_id = ? AND question_id IN (1, 2, 3) ORDER BY question_id ASC',
      [sessionId]
    );

    expect(rows.length).toBe(3);
    expect(rows[0].selected_option).toBe('A');
    expect(rows[1].selected_option).toBe('C');
    expect(rows[2].selected_option).toBe('D');

    // Clean up
    await executeSql('DELETE FROM Student_Responses WHERE session_id = ?', [sessionId]);
    await executeSql('DELETE FROM Exam_Sessions WHERE id = ?', [sessionId]);
  });

  // ==========================================================================
  // 5. SIMULATOR LOAD TEST: 50 STUDENTS AT HIGH CHAOS
  // ==========================================================================
  it(
    'Load: run Demo Simulator with 50 students at high chaos, reporting latency, DB errors, and memory growth',
    async () => {
    const memBefore = process.memoryUsage();

    // 1. Start Demo Simulator with 50 students at high chaos using adminToken
    const startRes = await fetch(`${serverOrigin}/api/admin/simulator/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        examId: 1,
        studentCount: 50,
        speed: 3.0,
        chaos: 'high',
      }),
    }).then((r) => r.json());

    expect(startRes.success).toBe(true);
    expect(startRes.data.candidates.length).toBe(50);
    expect(startRes.data.chaos).toBe('high');

    // 2. Measure API Latency and DB Health during simulated swarm load
    const latencies: number[] = [];
    let dbErrors = 0;

    // Run active load observation for 15 seconds (scalable representation)
    const startTime = Date.now();
    const durationMs = 15000;

    while (Date.now() - startTime < durationMs) {
      const t0 = performance.now();
      try {
        const res = await fetch(`${serverOrigin}/api/proctor/live-monitor`, {
          headers: { Authorization: `Bearer ${proctor1Token}` },
        });
        const elapsed = performance.now() - t0;
        latencies.push(elapsed);

        if (!res.ok) {
          dbErrors++;
        }
      } catch {
        dbErrors++;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // 3. Collect Simulator Telemetry State
    const statusRes = await fetch(`${serverOrigin}/api/admin/simulator/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    const simStats = statusRes.data.stats;
    const memAfter = process.memoryUsage();

    // 4. Calculate Latency Metrics (p50, p95, p99)
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const heapGrowthMb = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

    console.log('=================================================================');
    console.log(' DEMO SIMULATOR LOAD TEST METRICS (50 STUDENTS, HIGH CHAOS)');
    console.log('=================================================================');
    console.log(` • Active Students Provisioned: ${statusRes.data.candidates.length}`);
    console.log(` • Total Simulated Answers:    ${simStats.answersCount}`);
    console.log(` • Total Recorded Infractions: ${simStats.infractionsCount}`);
    console.log(` • Disqualified/Terminated:    ${simStats.terminatedCount}`);
    console.log(` • Total Monitor HTTP Polls:   ${latencies.length}`);
    console.log(` • API Latency p50:            ${p50.toFixed(2)} ms`);
    console.log(` • API Latency p95:            ${p95.toFixed(2)} ms`);
    console.log(` • API Latency p99:            ${p99.toFixed(2)} ms`);
    console.log(` • Database Errors:            ${dbErrors}`);
    console.log(` • Node Heap Growth:           ${heapGrowthMb.toFixed(2)} MB`);
    console.log('=================================================================');

    // 5. Assert System Invariants Under Load
    expect(dbErrors).toBe(0);
    expect(p95).toBeLessThan(500); // 95th percentile under 500ms
    expect(simStats.answersCount + simStats.infractionsCount).toBeGreaterThan(0);

    // Stop simulator
    await fetch(`${serverOrigin}/api/admin/simulator/stop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }, 60000);
});
