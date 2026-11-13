import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import {
  clearViolationDebounceCache,
  shouldDebounceViolation,
} from '../src/services/violationGuard.js';
import { mapMysqlError } from '../src/utils/errors.js';

test('mapMysqlError maps SQLSTATE 45000 trigger SIGNAL to deterministic AppError', () => {
  const err1 = mapMysqlError(
    Object.assign(new Error('Cannot log violation: exam session is no longer IN_PROGRESS.'), {
      sqlState: '45000',
      errno: 1644,
    })
  );
  assert.ok(err1);
  assert.equal(err1.statusCode, 409);
  assert.equal(err1.code, 'DB_RULE_VIOLATION');

  const err2 = mapMysqlError(
    Object.assign(new Error('Exam not found.'), {
      sqlState: '45000',
      errno: 1644,
    })
  );
  assert.ok(err2);
  assert.equal(err2.statusCode, 404);
  assert.equal(err2.code, 'DB_RESOURCE_NOT_FOUND');

  const dup = mapMysqlError(
    Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    })
  );
  assert.ok(dup);
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.code, 'DUPLICATE_RECORD');
});

test('shouldDebounceViolation suppresses duplicate (sessionId, code) within 3 seconds', () => {
  clearViolationDebounceCache();
  const t0 = 1_700_000_000_000;

  assert.equal(shouldDebounceViolation(10, 'TAB_SWITCH', t0), false);
  assert.equal(shouldDebounceViolation(10, 'TAB_SWITCH', t0 + 1500), true);
  assert.equal(shouldDebounceViolation(10, 'FULLSCREEN_EXIT', t0 + 1500), false);
  assert.equal(shouldDebounceViolation(11, 'TAB_SWITCH', t0 + 1500), false);
  assert.equal(shouldDebounceViolation(10, 'TAB_SWITCH', t0 + 3001), false);
});

test('Express API enforces { success, data, error } envelope, JWT RBAC, Zod validation, and Swagger /api/docs', async () => {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Swagger OpenAPI JSON & UI
    const specRes = await fetch(`${baseUrl}/api/docs.json`);
    assert.equal(specRes.status, 200);
    const specJson = (await specRes.json()) as { openapi: string; paths: Record<string, unknown> };
    assert.equal(specJson.openapi, '3.0.3');
    assert.ok('/sessions/{id}/submit' in specJson.paths);

    const docsRes = await fetch(`${baseUrl}/api/docs/`);
    assert.equal(docsRes.status, 200);

    // 2. 404 route check
    const notFoundRes = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.equal(notFoundRes.status, 404);
    const notFoundJson = (await notFoundRes.json()) as {
      success: boolean;
      data: unknown;
      error: { code: string } | null;
    };
    assert.equal(notFoundJson.success, false);
    assert.equal(notFoundJson.data, null);
    assert.equal(notFoundJson.error?.code, 'ROUTE_NOT_FOUND');

    // 3. Unauthenticated protected route check
    const unauthRes = await fetch(`${baseUrl}/api/monitor/live`);
    assert.equal(unauthRes.status, 401);

    // 4. Role enforcement checks (STUDENT blocked from PROCTOR & ADMIN routes)
    const studentToken = jwt.sign(
      { sub: 99, email: 'student@test.io', fullName: 'Test Student', role: 'STUDENT' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const proctorToken = jwt.sign(
      { sub: 2, email: 'proctor@test.io', fullName: 'Test Proctor', role: 'PROCTOR' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const forbiddenMonitor = await fetch(`${baseUrl}/api/monitor/live`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(forbiddenMonitor.status, 403);

    const forbiddenAnalytics = await fetch(`${baseUrl}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(forbiddenAnalytics.status, 403);

    const forbiddenViolationEdit = await fetch(`${baseUrl}/api/violation-types/1`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${proctorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ penaltyPoints: 25 }),
    });
    assert.equal(forbiddenViolationEdit.status, 403);

    // 5. Zod validation error envelope check
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });
    assert.equal(badLoginRes.status, 400);
    const badLoginJson = (await badLoginRes.json()) as {
      success: boolean;
      error: { code: string } | null;
    };
    assert.equal(badLoginJson.success, false);
    assert.equal(badLoginJson.error?.code, 'VALIDATION_ERROR');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
});
