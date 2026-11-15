import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { io as ioClient } from '../../client/node_modules/socket.io-client/build/esm/index.js';
import { createApp } from '../src/app.js';
import { pool, testDbConnection } from '../src/config/db.js';
import { initSocketServer } from '../src/realtime/socket.js';

async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ status: number; json: { success: boolean; data: T; error: { code: string; message: string } | null } }> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const json = (await res.json()) as {
    success: boolean;
    data: T;
    error: { code: string; message: string } | null;
  };
  return { status: res.status, json };
}

test('All Admin, Student, Proctor endpoints and Socket.IO events work end-to-end against seeded MySQL', async (t) => {
  const dbReady = await testDbConnection();
  if (!dbReady) {
    t.skip('MySQL 8.0+ not running.');
    await pool.end();
    return;
  }

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const baseUrl = `${origin}/api`;

  let createdExamId: number | null = null;
  let createdVtId: number | null = null;
  let studentSessionId: number | null = null;
  let proctorSocket: ReturnType<typeof ioClient> | null = null;

  try {
    // Login Admin, Proctor, Student
    const adminLogin = await apiFetch<{ token: string }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' }),
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.json.data.token;

    const proctorLogin = await apiFetch<{ token: string }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' }),
    });
    assert.equal(proctorLogin.status, 200);
    const proctorToken = proctorLogin.json.data.token;

    const studentLogin = await apiFetch<{ token: string }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' }),
    });
    assert.equal(studentLogin.status, 200);
    const studentToken = studentLogin.json.data.token;

    // Connect Proctor Socket.IO listener
    proctorSocket = ioClient(origin, { auth: { token: proctorToken }, transports: ['websocket'] });
    const receivedEvents: string[] = [];
    proctorSocket.on('violation:new', () => receivedEvents.push('violation:new'));
    proctorSocket.on('session:update', () => receivedEvents.push('session:update'));
    proctorSocket.on('session:terminated', () => receivedEvents.push('session:terminated'));
    await new Promise<void>((resolve) => proctorSocket.on('connect', () => resolve()));

    // Admin: CRUD Exam + Question + Violation Type + Analytics
    const createExam = await apiFetch<{ id: number }>(baseUrl, '/exams', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        title: 'E2E Test Exam',
        description: 'Comprehensive exam syllabus that has more than 20 characters for E2E testing',
        durationMinutes: 30,
        minTrustScore: 50,
        startWindow: new Date(Date.now() - 3600_000).toISOString(),
        endWindow: new Date(Date.now() + 3600_000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'E2E sample question initial?',
            optionA: 'Alpha',
            optionB: 'Beta',
            optionC: 'Gamma',
            optionD: 'Delta',
            correctOption: 'A',
            marks: 5,
          },
        ],
      }),
    });
    assert.equal(createExam.status, 201);
    createdExamId = createExam.json.data.id;

    const addQ = await apiFetch<{ id: number }>(baseUrl, `/exams/${createdExamId}/questions`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        questionText: 'E2E sample question?',
        optionA: 'Alpha',
        optionB: 'Beta',
        optionC: 'Gamma',
        optionD: 'Delta',
        correctOption: 'A',
        marks: 5,
      }),
    });
    assert.equal(addQ.status, 201);
    const qId = addQ.json.data.id;

    const createVt = await apiFetch<{ id: number }>(baseUrl, '/violation-types', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        code: 'TEST_E2E_SENSOR',
        label: 'Test E2E Sensor',
        penaltyPoints: 12,
        severity: 'LOW',
      }),
    });
    assert.equal(createVt.status, 201);
    createdVtId = createVt.json.data.id;

    const patchVt = await apiFetch<{ penalty_points: number }>(
      baseUrl,
      `/violation-types/${createdVtId}`,
      {
        method: 'PATCH',
        token: adminToken,
        body: JSON.stringify({ penaltyPoints: 18 }),
      }
    );
    assert.equal(patchVt.status, 200);
    assert.equal(patchVt.json.data.penalty_points, 18);

    const overview = await apiFetch<{ summary: { totalExams: number } }>(
      baseUrl,
      '/analytics/overview',
      { token: adminToken }
    );
    assert.equal(overview.status, 200);
    assert.ok(overview.json.data.summary.totalExams >= 4);

    const heatmap = await apiFetch<unknown[]>(baseUrl, '/analytics/heatmap', { token: adminToken });
    assert.equal(heatmap.status, 200);
    assert.ok(Array.isArray(heatmap.json.data) && heatmap.json.data.length > 0);

    // Student: available exams -> start -> resume -> questions -> time-left -> answer -> violation (debounce)
    const avail = await apiFetch<Array<{ id: number }>>(baseUrl, '/exams/available', {
      token: studentToken,
    });
    assert.equal(avail.status, 200);
    assert.ok(avail.json.data.some((e) => e.id === createdExamId));

    const start = await apiFetch<{ id: number; session_token: string }>(
      baseUrl,
      `/exams/${createdExamId}/start`,
      {
        method: 'POST',
        token: studentToken,
        body: JSON.stringify({ deviceFingerprint: 'e2e-fp-1' }),
      }
    );
    assert.equal(start.status, 201);
    studentSessionId = start.json.data.id;
    const sToken = start.json.data.session_token;

    // Matching resume -> 200
    const resume = await apiFetch<{ id: number }>(baseUrl, `/exams/${createdExamId}/start`, {
      method: 'POST',
      token: studentToken,
      body: JSON.stringify({ deviceFingerprint: 'e2e-fp-1', sessionToken: sToken }),
    });
    assert.equal(resume.status, 200);
    assert.equal(resume.json.data.id, studentSessionId);

    // Questions must NOT expose correct_option
    const qRes = await apiFetch<{ questions: Array<Record<string, unknown>> }>(
      baseUrl,
      `/sessions/${studentSessionId}/questions`,
      { token: studentToken }
    );
    assert.equal(qRes.status, 200);
    assert.equal('correct_option' in qRes.json.data.questions[0], false);

    // Server timer
    const timeLeft = await apiFetch<{ secondsLeft: number }>(
      baseUrl,
      `/sessions/${studentSessionId}/time-left`,
      { token: studentToken }
    );
    assert.equal(timeLeft.status, 200);
    assert.ok(timeLeft.json.data.secondsLeft > 1000);

    // Upsert answer
    const ans = await apiFetch<{ selectedOption: string }>(
      baseUrl,
      `/sessions/${studentSessionId}/answer`,
      {
        method: 'PUT',
        token: studentToken,
        body: JSON.stringify({ questionId: qId, selectedOption: 'A' }),
      }
    );
    assert.equal(ans.status, 200);

    // Violation 1 -> deducted, Violation 2 same code immediately -> debounced!
    const viol1 = await apiFetch<{ logId: number; trust_score: number; debounced: boolean }>(
      baseUrl,
      `/sessions/${studentSessionId}/violation`,
      {
        method: 'POST',
        token: studentToken,
        body: JSON.stringify({ code: 'TAB_SWITCH', snapshot: 'frame-1' }),
      }
    );
    assert.equal(viol1.status, 201);
    assert.equal(viol1.json.data.trust_score, 85);
    assert.equal(viol1.json.data.debounced, false);
    const logId = viol1.json.data.logId;

    const violDup = await apiFetch<{ debounced: boolean; trust_score: number }>(
      baseUrl,
      `/sessions/${studentSessionId}/violation`,
      {
        method: 'POST',
        token: studentToken,
        body: JSON.stringify({ code: 'TAB_SWITCH' }),
      }
    );
    assert.equal(violDup.status, 200);
    assert.equal(violDup.json.data.debounced, true);
    assert.equal(violDup.json.data.trust_score, 85);

    // Proctor: monitor/live, monitor/audit, timeline, review DISMISSED (restores trust to 100), force-terminate
    const liveMon = await apiFetch<unknown[]>(baseUrl, '/monitor/live', { token: proctorToken });
    assert.equal(liveMon.status, 200);

    const auditMon = await apiFetch<unknown[]>(
      baseUrl,
      `/monitor/audit?sessionId=${studentSessionId}`,
      { token: proctorToken }
    );
    assert.equal(auditMon.status, 200);
    assert.equal(auditMon.json.data.length, 1);

    const timeline = await apiFetch<{ timeline: unknown[] }>(
      baseUrl,
      `/sessions/${studentSessionId}/timeline`,
      { token: proctorToken }
    );
    assert.equal(timeline.status, 200);
    assert.equal(timeline.json.data.timeline.length, 1);

    const review = await apiFetch<{ current_trust_score: number }>(
      baseUrl,
      `/logs/${logId}/review`,
      {
        method: 'PATCH',
        token: proctorToken,
        body: JSON.stringify({ status: 'DISMISSED', reviewNotes: 'Cleared in E2E' }),
      }
    );
    assert.equal(review.status, 200);
    assert.equal(review.json.data.current_trust_score, 100);

    const term = await apiFetch<{ status: string }>(
      baseUrl,
      `/sessions/${studentSessionId}/force-terminate`,
      {
        method: 'POST',
        token: proctorToken,
        body: JSON.stringify({ reason: 'E2E force terminate verification' }),
      }
    );
    assert.equal(term.status, 200);
    assert.equal(term.json.data.status, 'TERMINATED_CHEATING');

    const resultRes = await apiFetch<{ result: { integrity_status: string } }>(
      baseUrl,
      `/sessions/${studentSessionId}/result`,
      { token: studentToken }
    );
    assert.equal(resultRes.status, 200);
    assert.equal(resultRes.json.data.result.integrity_status, 'DISQUALIFIED');

    // Allow Socket.IO ticks to flush
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(receivedEvents.includes('violation:new'));
    assert.ok(receivedEvents.includes('session:update'));
    assert.ok(receivedEvents.includes('session:terminated'));
  } finally {
    if (proctorSocket) {
      proctorSocket.disconnect();
    }
    if (createdExamId !== null) {
      await pool.execute('DELETE FROM Exams WHERE id = ?', [createdExamId]);
    }
    if (createdVtId !== null) {
      await pool.execute('DELETE FROM Violation_Types WHERE id = ?', [createdVtId]);
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      setTimeout(resolve, 500);
    });
    await pool.end();
  }
});
