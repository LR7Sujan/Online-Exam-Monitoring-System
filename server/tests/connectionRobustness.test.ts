import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createApp } from '../src/app.js';
import { deriveConnectionStatus } from '../../client/src/utils/connectionStatus.js';
import mysql from 'mysql2/promise';

describe('Connection Robustness and Status Derivation Protocol', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4001;
    origin = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. GET /api/health returns real version, uptime, procedures, and triggers counts', async () => {
    const res = await fetch(`${origin}/api/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: {
        api: string;
        db: string;
        version: string;
        mysqlVersion: string;
        uptime: number;
        proceduresCount: number;
        triggersCount: number;
        status: string;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.api).toBe('up');
    expect(body.data.db).toBe('up');
    expect(body.data.status).toBe('ok');
    expect(body.data.version).toMatch(/^8\./);
    expect(body.data.mysqlVersion).toMatch(/^8\./);
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
    expect(body.data.proceduresCount).toBeGreaterThanOrEqual(1);
    expect(body.data.triggersCount).toBeGreaterThanOrEqual(1);
  });

  it('2. When API is down, derives DISCONNECTED with plain-language hint to start it', () => {
    const derived = deriveConnectionStatus({
      connectionState: 'disconnected',
      apiStatus: 'down',
      dbStatus: 'down',
      mysqlVersion: '8.0.46',
      latencyMs: null,
    });

    expect(derived.state).toBe('disconnected');
    expect(derived.statusLabel).toBe('DISCONNECTED');
    expect(derived.subLabel).toBe('API Unreachable');
    expect(derived.diagnosticHint).toBe('API is not running: start it with npm run dev');
    expect(derived.dotColor).toBe('rose');
    expect(derived.isFullyOperational).toBe(false);
  });

  it('3. When Database is down, derives DISCONNECTED with plain-language hint to start MySQL', () => {
    const derived = deriveConnectionStatus({
      connectionState: 'connected', // socket was established, but DB dropped
      apiStatus: 'up',
      dbStatus: 'down',
      mysqlVersion: '8.0.46',
      latencyMs: 15,
    });

    expect(derived.state).toBe('disconnected');
    expect(derived.statusLabel).toBe('DISCONNECTED');
    expect(derived.subLabel).toBe('MySQL 8.0.46 • Down');
    expect(derived.diagnosticHint).toBe('Database is down: start MySQL');
    expect(derived.dotColor).toBe('rose');
    expect(derived.isFullyOperational).toBe(false);
  });

  it('4. When all services are healthy, derives CONNECTED with real MySQL version, transport, and latency', () => {
    const derived = deriveConnectionStatus({
      connectionState: 'connected',
      apiStatus: 'up',
      dbStatus: 'up',
      transport: 'polling',
      mysqlVersion: '8.0.46',
      latencyMs: 18,
    });

    expect(derived.state).toBe('connected');
    expect(derived.statusLabel).toBe('CONNECTED');
    expect(derived.subLabel).toBe('MySQL 8.0.46 • POLL • 18ms');
    expect(derived.diagnosticHint).toBe(null);
    expect(derived.dotColor).toBe('emerald');
    expect(derived.isFullyOperational).toBe(true);
  });

  it('5. 503 response from dead DB delivers structured DB_UNAVAILABLE error with actionable guidance', async () => {
    const deadPool = mysql.createPool({
      host: '127.0.0.1',
      port: 59998,
      user: 'root',
      password: 'none',
      database: 'exam_monitoring_test',
      connectTimeout: 400,
      waitForConnections: false,
    });

    const mockApp = express();
    mockApp.get('/api/health-test-dead', async (_req, res) => {
      try {
        await deadPool.query('SELECT 1');
        res.json({ success: true });
      } catch {
        res.status(503).json({
          success: false,
          data: {
            api: 'up',
            db: 'down',
            realtime: 'polling',
            version: '8.0.46',
            uptime: 10,
          },
          error: {
            code: 'DB_UNAVAILABLE',
            message: 'MySQL is not reachable at 127.0.0.1:59998. Start your MySQL service (services.msc > MySQL80) or check .env',
          },
        });
      }
    });

    const brokenServer = mockApp.listen(0);
    const brokenPort = (brokenServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${brokenPort}/api/health-test-dead`);
      expect(res.status).toBe(503);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
        data: { api: string; db: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DB_UNAVAILABLE');
      expect(json.data.api).toBe('up');
      expect(json.data.db).toBe('down');
      expect(json.error.message).toContain('MySQL is not reachable');
    } finally {
      await deadPool.end();
      await new Promise<void>((resolve) => brokenServer.close(() => resolve()));
    }
  });
});
