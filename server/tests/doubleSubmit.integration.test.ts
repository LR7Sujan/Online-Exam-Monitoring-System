import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { pool, queryRows, testDbConnection } from '../src/config/db.js';

/**
 * Integration test against live MySQL 8.0+ verifying:
 * 1. Student login against seeded credentials
 * 2. POST /api/exams/:id/start creates session with IP, fingerprint, session_token
 *    and rejects mismatched duplicate starts with 409
 * 3. Concurrent double-submit (two parallel POST /api/sessions/:id/submit calls)
 *    produces EXACTLY ONE Results row via sp_SubmitAndGradeExam (SELECT ... FOR UPDATE)
 */
test('Concurrent double-submit produces exactly one Results row against seeded MySQL', async (t) => {
  const dbReady = await testDbConnection();
  if (!dbReady) {
    t.skip('MySQL 8.0+ is not running locally; start Docker/MySQL and run npm --prefix server test.');
    await pool.end();
    return;
  }

  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let createdSessionId: number | null = null;

  try {
    // 1. Authenticate as seeded student@proctoriq.io (id=5, free on live Exam 1)
    await pool.execute('DELETE FROM Exam_Sessions WHERE exam_id = 1 AND student_id = 5');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' }),
    });
    assert.equal(loginRes.status, 200);
    const loginJson = (await loginRes.json()) as {
      success: boolean;
      data: { token: string; user: { id: number } };
    };
    const token = loginJson.data.token;

    // 2. Start live Exam 1 with fingerprint
    const startRes = await fetch(`${baseUrl}/exams/1/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceFingerprint: 'integration-test-fp' }),
    });
    assert.equal(startRes.status, 201);
    const startJson = (await startRes.json()) as {
      success: boolean;
      data: { id: number; session_token: string };
    };
    createdSessionId = startJson.data.id;
    const sessionToken = startJson.data.session_token;
    assert.ok(sessionToken.length >= 32);

    // 3. Duplicate start with mismatched fingerprint must fail with 409
    const mismatchRes = await fetch(`${baseUrl}/exams/1/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceFingerprint: 'rogue-device', sessionToken }),
    });
    assert.equal(mismatchRes.status, 409);

    // 4. Concurrent double-submit in parallel
    const [submitA, submitB] = await Promise.all([
      fetch(`${baseUrl}/sessions/${createdSessionId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${baseUrl}/sessions/${createdSessionId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    assert.equal(submitA.status, 200);
    assert.equal(submitB.status, 200);

    const jsonA = (await submitA.json()) as { success: boolean; data: { id: number } };
    const jsonB = (await submitB.json()) as { success: boolean; data: { id: number } };
    assert.equal(jsonA.success, true);
    assert.equal(jsonB.success, true);
    assert.equal(jsonA.data.id, jsonB.data.id);

    // 5. Verify MySQL Results table has EXACTLY 1 row for this session
    const countRows = await queryRows<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM Results WHERE session_id = ?',
      [createdSessionId]
    );
    assert.equal(Number(countRows[0].cnt), 1);
  } finally {
    if (createdSessionId !== null) {
      await pool.execute('DELETE FROM Exam_Sessions WHERE id = ?', [createdSessionId]);
    }
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    await pool.end();
  }
});

