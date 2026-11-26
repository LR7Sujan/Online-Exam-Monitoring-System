import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { Request, Response } from 'express';
import handler from '../../api/index.js';

describe('Vercel Serverless Entrypoint (/api/index.ts)', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    // Wrap the exported serverless function handler directly in an HTTP server
    server = createServer((req, res) => {
      handler(req as unknown as Request, res as unknown as Response);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 4001;
        origin = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/health through serverless entry returns api, db, ping, time, and region', async () => {
    const res = await fetch(`${origin}/api/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: {
        api: string;
        db: string;
        pingMs: number;
        time: string;
        region: string;
        status: string;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.api).toBe('up');
    expect(body.data.db).toBe('up');
    expect(body.data.status).toBe('ok');
    expect(typeof body.data.pingMs).toBe('number');
    expect(typeof body.data.time).toBe('string');
    expect(typeof body.data.region).toBe('string');
  });

  it('GET /api/docs.json through serverless entry returns valid OpenAPI specification', async () => {
    const res = await fetch(`${origin}/api/docs.json`);
    expect(res.status).toBe(200);

    const spec = (await res.json()) as { openapi?: string; info?: { title: string } };
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info?.title).toContain('ProctorIQ');
  });

  it('POST /api/auth/login and authenticated GET /api/exams work through serverless handler', async () => {
    // 1. Login
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@proctoriq.io',
        password: 'ProctorIQ#2026',
      }),
    });
    expect(loginRes.status).toBe(200);

    const loginBody = (await loginRes.json()) as {
      success: boolean;
      data: { token: string; user: { role: string } };
    };
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.user.role).toBe('STUDENT');
    const token = loginBody.data.token;

    // 2. Authenticated exams lookup
    const examsRes = await fetch(`${origin}/api/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(examsRes.status).toBe(200);

    const examsBody = (await examsRes.json()) as {
      success: boolean;
      data: unknown[];
    };
    expect(examsBody.success).toBe(true);
    expect(Array.isArray(examsBody.data)).toBe(true);
  });
});
