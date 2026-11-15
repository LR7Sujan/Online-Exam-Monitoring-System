import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { pool, executeSql } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import type { RowDataPacket } from 'mysql2/promise';

function makeToken(payload: { sub: number; email: string; role: 'STUDENT' | 'PROCTOR' | 'ADMIN'; fullName: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Exam Lifecycle, Confirmations & Audit Invariant API Tests', () => {
  let server: HttpServer;
  let serverPort: number;
  let serverOrigin: string;
  let adminToken: string;

  beforeAll(async () => {
    const app = createApp();
    server = app.listen(0);
    const address = server.address();
    serverPort = typeof address === 'object' && address ? address.port : 4002;
    serverOrigin = `http://localhost:${serverPort}`;

    adminToken = makeToken({
      sub: 1,
      email: 'admin@proctoriq.io',
      role: 'ADMIN',
      fullName: 'Dr. Elena Vance',
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // Helper to create a fresh exam
  async function createTestExam(isPublished = false) {
    const title = `Lifecycle Exam ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const startWin = new Date().toISOString();
    const endWin = new Date(Date.now() + 86400000 * 2).toISOString();

    const questions = [
      {
        questionText: 'Test question 1 for lifecycle?',
        optionA: 'Option A1',
        optionB: 'Option B1',
        correctOption: 'A',
        marks: 2,
      },
      {
        questionText: 'Test question 2 for lifecycle?',
        optionA: 'Option A2',
        optionB: 'Option B2',
        correctOption: 'B',
        marks: 3,
      },
    ];

    const res = await fetch(`${serverOrigin}/api/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title,
        description: 'Comprehensive exam description that easily satisfies twenty characters minimum requirement.',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: startWin,
        endWindow: endWin,
        isPublished,
        questions,
      }),
    });
    const json = await res.json();
    return json.data;
  }

  // 1. Question modification blocked on published exam
  it('1. Question create, bulk import, update, delete and reorder return 409 on published exams', async () => {
    const exam = await createTestExam(true);
    expect(exam.is_published).toBe(1);

    // Fetch questions
    const [qRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM Questions WHERE exam_id = ? ORDER BY id ASC',
      [exam.id]
    );
    expect(qRows.length).toBeGreaterThan(0);
    const qId = qRows[0].id;

    // A) Try to add single question
    const addRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        questionText: 'Blocked question prompt?',
        optionA: 'A',
        optionB: 'B',
        correctOption: 'A',
        marks: 1,
      }),
    });
    const addJson = await addRes.json();
    expect(addRes.status).toBe(409);
    expect(addJson.error.code).toBe('EXAM_PUBLISHED');

    // B) Try to bulk import questions
    const bulkRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/questions/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        questions: [
          {
            questionText: 'Bulk prompt?',
            optionA: 'A',
            optionB: 'B',
            optionC: 'C',
            optionD: 'D',
            correctOption: 'A',
            marks: 1,
          },
        ],
      }),
    });
    const bulkJson = await bulkRes.json();
    expect(bulkRes.status).toBe(409);
    expect(bulkJson.error.code).toBe('EXAM_PUBLISHED');

    // C) Try to update question
    const updateRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/questions/${qId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        questionText: 'Updated question prompt that should fail?',
      }),
    });
    const updateJson = await updateRes.json();
    expect(updateRes.status).toBe(409);
    expect(updateJson.error.code).toBe('EXAM_PUBLISHED');

    // D) Try to delete question
    const delRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/questions/${qId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const delJson = await delRes.json();
    expect(delRes.status).toBe(409);
    expect(delJson.error.code).toBe('EXAM_PUBLISHED');

    // E) Try to reorder questions
    const reorderRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/questions/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        questionIds: qRows.map((r) => r.id).reverse(),
      }),
    });
    const reorderJson = await reorderRes.json();
    expect(reorderRes.status).toBe(409);
    expect(reorderJson.error.code).toBe('EXAM_PUBLISHED');
  });

  // 2. Modifying parameters on published exam returns 409
  it('2. Modifying assessment parameters on a published exam returns 409', async () => {
    const exam = await createTestExam(true);

    const res = await fetch(`${serverOrigin}/api/exams/${exam.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Attempting to change title of published exam',
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error.code).toBe('EXAM_PUBLISHED');
  });

  // 3. Unpublish blocks when an active session is IN_PROGRESS (returns 409)
  it('3. Unpublish returns 409 when an active session is IN_PROGRESS', async () => {
    const exam = await createTestExam(true);

    // Create an in-progress session for this exam
    const sessionRes = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, session_token, ip_address, device_fingerprint, status, trust_score, server_deadline)
       VALUES (?, 1, ?, '127.0.0.1', 'test-fp', 'IN_PROGRESS', 100, DATE_ADD(NOW(), INTERVAL 60 MINUTE))`,
      [exam.id, `tok-active-${Date.now()}`]
    );
    const sessionId = sessionRes.insertId;

    // A) Try unpublish via dedicated endpoint
    const unpubRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/unpublish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const unpubJson = await unpubRes.json();
    expect(unpubRes.status).toBe(409);
    expect(unpubJson.error.code).toBe('ACTIVE_SESSIONS_IN_PROGRESS');
    expect(unpubJson.error.message).toContain('IN_PROGRESS');

    // B) Try unpublish via PATCH body
    const patchRes = await fetch(`${serverOrigin}/api/exams/${exam.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        isPublished: false,
      }),
    });
    const patchJson = await patchRes.json();
    expect(patchRes.status).toBe(409);
    expect(patchJson.error.code).toBe('ACTIVE_SESSIONS_IN_PROGRESS');

    // Clean up session: mark as SUBMITTED so unpublish succeeds later
    await executeSql("UPDATE Exam_Sessions SET status = 'SUBMITTED' WHERE id = ?", [sessionId]);
  });

  // 4. Unpublish succeeds when no session is IN_PROGRESS
  it('4. Unpublish succeeds when 0 sessions are IN_PROGRESS', async () => {
    const exam = await createTestExam(true);

    const res = await fetch(`${serverOrigin}/api/exams/${exam.id}/unpublish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.is_published).toBe(0);

    // Verify questions can now be edited since it is unpublished
    const [qRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM Questions WHERE exam_id = ? ORDER BY id ASC',
      [exam.id]
    );
    const qId = qRows[0].id;

    const editQRes = await fetch(`${serverOrigin}/api/exams/${exam.id}/questions/${qId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        questionText: 'Edited now that exam is unpublished!',
      }),
    });
    const editQJson = await editQRes.json();
    expect(editQRes.status).toBe(200);
    expect(editQJson.data.question_text).toBe('Edited now that exam is unpublished!');
  });

  // 5. Delete permanently: published exam cannot be deleted
  it('5. Delete permanently returns 409 on published exam', async () => {
    const exam = await createTestExam(true);

    const res = await fetch(`${serverOrigin}/api/exams/${exam.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error.code).toBe('EXAM_PUBLISHED');
  });

  // 6. Delete permanently: returns 409 if any session or audit data exists
  it('6. Delete permanently returns 409 if any session or audit data exists', async () => {
    const exam = await createTestExam(false);

    // Add a completed session
    await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, session_token, ip_address, device_fingerprint, status, trust_score, server_deadline)
       VALUES (?, 1, ?, '127.0.0.1', 'test-fp', 'SUBMITTED', 95, NOW())`,
      [exam.id, `tok-submitted-${Date.now()}`]
    );

    const res = await fetch(`${serverOrigin}/api/exams/${exam.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error.code).toBe('AUDIT_DATA_EXISTS');
    expect(json.error.message).toContain('audit records');
  });

  // 7. Delete permanently: succeeds for a draft exam with 0 sessions
  it('7. Delete permanently succeeds for a draft exam with 0 sessions', async () => {
    const exam = await createTestExam(false);

    const res = await fetch(`${serverOrigin}/api/exams/${exam.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.deleted).toBe(true);

    // Verify exam and its questions are gone
    const [eRows] = await pool.query<RowDataPacket[]>('SELECT id FROM Exams WHERE id = ?', [exam.id]);
    expect(eRows.length).toBe(0);

    const [qRows] = await pool.query<RowDataPacket[]>('SELECT id FROM Questions WHERE exam_id = ?', [exam.id]);
    expect(qRows.length).toBe(0);
  });
});
