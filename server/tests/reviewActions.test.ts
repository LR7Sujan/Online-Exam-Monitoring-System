import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { executeSql, queryRows } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface ReviewResponse {
  success: boolean;
  data?: {
    id: number;
    proctor_review_status: string;
    reviewed_by?: number;
    review_notes?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

describe('Violation Review Actions API (CONFIRM, DISMISS, Idempotency & Role Checks)', () => {
  let server: Server;
  let origin: string;
  let proctorToken: string;
  let adminToken: string;
  let studentToken: string;

  let testStudentId: number;
  let testExamId: number;
  let testSessionId: number;
  let testLogId: number;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4001;
    origin = `http://localhost:${port}`;

    // Create tokens
    adminToken = jwt.sign(
      { sub: 1, email: 'admin@proctoriq.io', role: 'ADMIN', fullName: 'Dr. Elena Vance' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    proctorToken = jwt.sign(
      { sub: 2, email: 'proctor@proctoriq.io', role: 'PROCTOR', fullName: 'Marcus Sterling' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    studentToken = jwt.sign(
      { sub: 3, email: 'student@proctoriq.io', role: 'STUDENT', fullName: 'Aarav Chen' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Fetch or create dedicated student user for this test
    const userRes = await executeSql(
      `INSERT INTO Users (email, password_hash, full_name, role)
       VALUES ('test-rev-${Date.now()}@proctoriq.io', '$2a$10$abcdefghijklmnopqrstuu', 'Test Review Student', 'STUDENT')`
    );
    testStudentId = Number((userRes as ResultSetHeader).insertId);

    const eRows = await queryRows<RowDataPacket[]>('SELECT id FROM Exams LIMIT 1');
    testExamId = Number(eRows[0]?.id || 1);

    // Insert isolated exam session with starting trust score of 85
    const sessResult = await executeSql(
      `INSERT INTO Exam_Sessions (student_id, exam_id, paper_code, started_at, server_deadline, trust_score, status)
       VALUES (?, ?, 'TEST-REV-01', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE), 85, 'IN_PROGRESS')`,
      [testStudentId, testExamId]
    );
    testSessionId = Number((sessResult as ResultSetHeader).insertId);

    // Insert a violation log with penalty 15 (trust drops to 70 when inserted)
    const logResult = await executeSql(
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied, occurred_at, proctor_review_status)
       VALUES (?, 1, 15, NOW(), 'PENDING')`,
      [testSessionId]
    );
    testLogId = Number((logResult as ResultSetHeader).insertId);
  });

  afterAll(async () => {
    if (testSessionId) {
      await executeSql('DELETE FROM Exam_Sessions WHERE id = ?', [testSessionId]);
    }
    if (testStudentId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [testStudentId]);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Rejects student role with 403 Forbidden', async () => {
    const res = await fetch(`${origin}/api/proctor/logs/${testLogId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as ReviewResponse;
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe('FORBIDDEN');
  });

  it('2. Rejects invalid status with 400 and clear field error', async () => {
    const res = await fetch(`${origin}/api/proctor/logs/${testLogId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proctorToken}`,
      },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ReviewResponse;
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe('VALIDATION_ERROR');
    expect(json.error?.message).toContain('status');
  });

  it('3. Returns 404 for non-existent logId', async () => {
    const res = await fetch(`${origin}/api/proctor/logs/999999999/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proctorToken}`,
      },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as ReviewResponse;
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe('LOG_NOT_FOUND');
  });

  it('4. Successfully confirms violation with case-insensitive status', async () => {
    const res = await fetch(`${origin}/api/proctor/logs/${testLogId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proctorToken}`,
      },
      body: JSON.stringify({ status: 'confirmed', note: 'Staff confirmed via review' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as ReviewResponse;
    expect(json.success).toBe(true);
    expect(json.data?.proctor_review_status).toBe('CONFIRMED');
    expect(json.data?.reviewed_by).toBe(2);

    // Verify DB
    const rows = await queryRows<RowDataPacket[]>('SELECT proctor_review_status FROM Proctoring_Logs WHERE id = ?', [testLogId]);
    expect(rows[0]?.proctor_review_status).toBe('CONFIRMED');
  });

  it('5. Successfully dismisses violation and restores penalty points through DB trigger', async () => {
    const res = await fetch(`${origin}/api/proctor/logs/${testLogId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'dismissed' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as ReviewResponse;
    expect(json.success).toBe(true);
    expect(json.data?.proctor_review_status).toBe('DISMISSED');

    // DB trigger should have added 15 penalty points back to Exam_Sessions trust_score (up to 85)
    const sRows = await queryRows<RowDataPacket[]>('SELECT trust_score FROM Exam_Sessions WHERE id = ?', [testSessionId]);
    expect(Number(sRows[0]?.trust_score)).toBe(85);
  });

  it('6. Idempotency: reviewing twice does not double-restore points', async () => {
    const scoreBefore = await queryRows<RowDataPacket[]>('SELECT trust_score FROM Exam_Sessions WHERE id = ?', [testSessionId]);

    // Review again as DISMISSED
    const res = await fetch(`${origin}/api/proctor/logs/${testLogId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'DISMISSED' }),
    });

    expect(res.status).toBe(200);
    const scoreAfter = await queryRows<RowDataPacket[]>('SELECT trust_score FROM Exam_Sessions WHERE id = ?', [testSessionId]);
    expect(Number(scoreAfter[0]?.trust_score)).toBe(Number(scoreBefore[0]?.trust_score));
  });

  it('7. Trust points are strictly capped at 100 on dismissal', async () => {
    const extraLogResult = await executeSql(
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied, occurred_at, proctor_review_status)
       VALUES (?, 1, 15, NOW(), 'CONFIRMED')`,
      [testSessionId]
    );
    const extraLogId = Number((extraLogResult as ResultSetHeader).insertId);

    // Set trust score close to ceiling (95) after the insert trigger
    await executeSql('UPDATE Exam_Sessions SET trust_score = 95 WHERE id = ?', [testSessionId]);

    const res = await fetch(`${origin}/api/proctor/logs/${extraLogId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'DISMISSED' }),
    });

    expect(res.status).toBe(200);
    const sRows = await queryRows<RowDataPacket[]>('SELECT trust_score FROM Exam_Sessions WHERE id = ?', [testSessionId]);
    expect(Number(sRows[0]?.trust_score)).toBe(100);
  });
});
