import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { initSocketServer } from '../src/realtime/socket.js';

const API_BASE = 'http://localhost:4000/api';

describe('API Security & Forensic Access Enforcement', () => {
  let studentToken: string;
  let refreshToken: string;
  let activeSessionId: number;
  let serverInstance: Server | null = null;

  // Ensure test server is listening on port 4000 if not already running externally
  beforeAll(async () => {
    try {
      const res = await fetch('http://localhost:4000/api/health');
      if (res.ok) return;
    } catch {
      // Port 4000 not listening; boot in-process server instance
    }
    const app = createApp();
    serverInstance = createServer(app);
    initSocketServer(serverInstance);
    await new Promise<void>((resolve) => serverInstance!.listen(4000, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    if (serverInstance) {
      await new Promise<void>((resolve) => serverInstance!.close(() => resolve()));
    }
  });

  it('enforces Helmet secure HTTP headers on all API responses', async () => {
    const res = await fetch('http://localhost:4000/api/health');
    expect(res.status).toBe(200);

    // Helmet security headers
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-dns-prefetch-control')).toBe('off');
  });

  it('issues JWT access token and 7-day refresh token on registration and login', async () => {
    const email = `security.student.${Date.now()}@proctoriq.io`;
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Security Candidate',
        email,
        password: 'ProctorIQ#2026',
      }),
    });
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.data.token).toBeDefined();
    expect(regData.data.refreshToken).toBeDefined();

    studentToken = regData.data.token;
    refreshToken = regData.data.refreshToken;
  });

  it('rotates and refreshes access tokens via POST /api/auth/refresh', async () => {
    const refRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refData = await refRes.json();
    expect(refData.success).toBe(true);
    expect(refData.data.token).toBeDefined();
    expect(refData.data.refreshToken).toBeDefined();
    expect(refData.data.user.role).toBe('STUDENT');

    studentToken = refData.data.token; // update active token
  });

  it('rejects invalid, malformed, or fake refresh tokens with HTTP 401', async () => {
    const fakeRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'fake.malformed.jwt.token' }),
    });
    const fakeData = await fakeRes.json();
    expect(fakeRes.status).toBe(401);
    expect(fakeData.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('strictly conceals correct_option from student questions endpoint', async () => {
    // Start session
    const startRes = await fetch(`${API_BASE}/exams/1/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ deviceFingerprint: `sec-fp-${Date.now()}` }),
    });
    const startData = await startRes.json();
    expect(startData.success).toBe(true);
    activeSessionId = startData.data.id || startData.data.session.id;

    // Fetch questions
    const qRes = await fetch(`${API_BASE}/sessions/${activeSessionId}/questions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const qData = await qRes.json();
    expect(qData.success).toBe(true);
    expect(Array.isArray(qData.data.questions)).toBe(true);
    expect(qData.data.questions.length).toBeGreaterThan(0);

    // Verify ZERO questions leak correct_option or answer keys
    for (const q of qData.data.questions) {
      expect(q).not.toHaveProperty('correct_option');
      expect(q).not.toHaveProperty('correctOption');
      expect(q).not.toHaveProperty('answer');
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('question_text');
      expect(q).toHaveProperty('option_a');
      expect(q).toHaveProperty('option_b');
      expect(q).toHaveProperty('option_c');
      expect(q).toHaveProperty('option_d');
    }
  });

  it('protects forensic snapshot URLs behind authentication (401 without token, 200 with token)', async () => {
    // 1. Report violation with snapshot
    const testSnapshot =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const violRes = await fetch(`${API_BASE}/sessions/${activeSessionId}/violation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        code: 'TAB_SWITCH',
        snapshot: testSnapshot,
      }),
    });
    const violData = await violRes.json();
    expect(violData.success).toBe(true);
    const snapshotUrl = violData.data.snapshot_url;
    expect(snapshotUrl).toMatch(/^\/uploads\/snapshot-/);

    // 2. Unauthenticated request to snapshot -> MUST return 401
    const unauthRes = await fetch(`http://localhost:4000${snapshotUrl}`);
    const unauthData = await unauthRes.json();
    expect(unauthRes.status).toBe(401);
    expect(unauthData.error.code).toBe('UNAUTHORIZED_SNAPSHOT_ACCESS');

    // 3. Authenticated request using ?token= query parameter -> MUST return 200
    const authQueryRes = await fetch(`http://localhost:4000${snapshotUrl}?token=${studentToken}`);
    expect(authQueryRes.status).toBe(200);

    // 4. Authenticated request using Bearer header -> MUST return 200
    const authHeaderRes = await fetch(`http://localhost:4000${snapshotUrl}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(authHeaderRes.status).toBe(200);
  });
});

