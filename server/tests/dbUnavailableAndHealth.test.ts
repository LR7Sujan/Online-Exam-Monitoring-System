import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { isDbConnectionError, mapMysqlError } from '../src/utils/errors.js';
import mysql from 'mysql2/promise';

describe('Database Availability, Error Mapping & Health Check (/api/health)', () => {
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

  it('GET /api/health reports 200 with db: up, triggersCount, and proceduresCount when database is healthy', async () => {
    const res = await fetch(`${origin}/api/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: {
        service: string;
        api: string;
        db: string;
        status: string;
        mysqlVersion: string;
        triggersCount: number;
        proceduresCount: number;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.api).toBe('up');
    expect(body.data.db).toBe('up');
    expect(body.data.status).toBe('ok');
    expect(typeof body.data.mysqlVersion).toBe('string');
    expect(body.data.triggersCount).toBeGreaterThanOrEqual(1);
    expect(body.data.proceduresCount).toBeGreaterThanOrEqual(1);
  });

  it('isDbConnectionError correctly detects all connection failure conditions', () => {
    expect(isDbConnectionError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(isDbConnectionError(Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true);
    expect(isDbConnectionError(Object.assign(new Error('getaddrinfo ENOTFOUND invalid-host'), { code: 'ENOTFOUND' }))).toBe(true);
    expect(isDbConnectionError(Object.assign(new Error('Connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' }))).toBe(true);
    expect(isDbConnectionError(new Error("Can't add new command when connection is in closed state"))).toBe(true);
    expect(isDbConnectionError(new Error('Invalid password'))).toBe(false);
  });

  it('mapMysqlError maps connection failure to 503 DB_UNAVAILABLE with actionable message', () => {
    const mapped = mapMysqlError(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
        code: 'ECONNREFUSED',
      })
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.statusCode).toBe(503);
    expect(mapped?.code).toBe('DB_UNAVAILABLE');
    expect(mapped?.message).toContain('MySQL is not reachable at');
    expect(mapped?.message).toContain('Start your MySQL service or check .env');
  });

  it('returns 503 DB_UNAVAILABLE on API requests when database is unreachable', async () => {
    // Spin up an isolated Express app whose pool targets a non-existent port (e.g. 59999)
    const deadPool = mysql.createPool({
      host: '127.0.0.1',
      port: 59999,
      user: 'root',
      password: 'none',
      database: 'exam_monitoring_test',
      connectTimeout: 500,
      waitForConnections: false,
    });

    const testApp = express();
    testApp.use(express.json());
    // Temporary route that queries the dead database pool to simulate unreachability
    testApp.get('/test-dead-db', async (_req, _res, next) => {
      try {
        await deadPool.query('SELECT 1');
      } catch (err) {
        next(err);
      }
    });
    testApp.use(errorHandler);

    const brokenServer = testApp.listen(0);
    const brokenPort = (brokenServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${brokenPort}/test-dead-db`);
      expect(res.status).toBe(503);

      const body = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DB_UNAVAILABLE');
      expect(body.error.message).toContain('MySQL is not reachable');
      expect(body.error.message).toContain('Start your MySQL service or check .env');
    } finally {
      await deadPool.end();
      await new Promise<void>((resolve) => brokenServer.close(() => resolve()));
    }
  });
});
