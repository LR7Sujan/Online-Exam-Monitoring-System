import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { executeSql, pool, queryRows } from '../src/config/db.js';

describe('Time Extension Requests: API, Security & SQL Invariant Tests', () => {
  const app = createApp();

  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let examWithExtId: number;
  let examNoExtId: number;
  let sharedSessionId: number;

  beforeAll(async () => {
    // 1. Authenticate users
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    adminToken = adminRes.body.data.token;

    const proctorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' });
    proctorToken = proctorRes.body.data.token;
    const _proctorId = proctorRes.body.data.user.id;
    void _proctorId;

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    studentToken = studentRes.body.data.token;
    const _studentId = studentRes.body.data.user.id;
    void _studentId;

    // 2. Create test exam with extensions allowed (max 15 mins)
    const createExtRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'API Test Exam: Extensions Allowed',
        description: 'Testing time extensions feature suite with full proctoring bounds.',
        durationMinutes: 10,
        minTrustScore: 60,
        maxExtensionMins: 15,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What is 2 + 2?',
            optionA: '3',
            optionB: '4',
            optionC: '5',
            optionD: '6',
            correctOption: 'B',
            marks: 5,
          },
        ],
      });
    expect(createExtRes.status).toBe(201);
    examWithExtId = createExtRes.body.data.id;

    // 3. Create test exam with extensions disabled (maxExtensionMins: 0)
    const createNoExtRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'API Test Exam: Extensions Disabled',
        description: 'Testing time extensions disabled validation and security gates.',
        durationMinutes: 10,
        minTrustScore: 60,
        maxExtensionMins: 0,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What is the speed of light?',
            optionA: '3x10^8 m/s',
            optionB: '100 m/s',
            optionC: '0 m/s',
            optionD: 'Infinite',
            correctOption: 'A',
            marks: 5,
          },
        ],
      });
    expect(createNoExtRes.status).toBe(201);
    examNoExtId = createNoExtRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up created test exams
    if (examWithExtId) {
      await executeSql('DELETE FROM Exams WHERE id = ?', [examWithExtId]);
    }
    if (examNoExtId) {
      await executeSql('DELETE FROM Exams WHERE id = ?', [examNoExtId]);
    }
    await pool.end();
  });

  it('1. Rejects time extension request when exam disables extensions (max_extension_mins = 0)', async () => {
    // Start session on exam with 0 max extension
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: examNoExtId });
    expect(startRes.status).toBe(201);
    const sessionId = startRes.body.data.id;

    // Fast-forward deadline to within 30s
    await executeSql(
      'UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL 30 SECOND) WHERE id = ?',
      [sessionId]
    );

    const extRes = await request(app)
      .post(`/api/sessions/${sessionId}/extension`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ requestedMinutes: 5, reason: 'Need more time' });

    expect(extRes.status).toBe(400);
    expect(extRes.body.error.code).toBe('EXTENSIONS_DISABLED');
  });

  it('2. Rejects time extension request when requested minutes exceed exam max_extension_mins', async () => {
    // Start session on examWithExtId (max 15 mins)
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: examWithExtId });
    expect(startRes.status).toBe(201);
    sharedSessionId = startRes.body.data.id;

    // Fast-forward deadline to within 30s
    await executeSql(
      'UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL 30 SECOND) WHERE id = ?',
      [sharedSessionId]
    );

    const extRes = await request(app)
      .post(`/api/sessions/${sharedSessionId}/extension`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ requestedMinutes: 20, reason: 'Requesting 20m when max is 15m' });

    expect(extRes.status).toBe(400);
    expect(extRes.body.error.code).toBe('EXCEEDS_MAX_EXTENSION');
  });

  it('3. Rejects time extension request when more than 60s remain in the exam', async () => {
    // Set deadline to 5 minutes in the future (> 60s)
    await executeSql(
      'UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL 300 SECOND) WHERE id = ?',
      [sharedSessionId]
    );

    const extRes = await request(app)
      .post(`/api/sessions/${sharedSessionId}/extension`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ requestedMinutes: 5, reason: 'Too early request' });

    expect(extRes.status).toBe(400);
    expect(extRes.body.error.code).toBe('TIME_NOT_EXPIRED');
  });

  it('4. Successfully accepts time extension request when time remaining <= 60s', async () => {
    // Set deadline to 20 seconds remaining
    await executeSql(
      'UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL 20 SECOND) WHERE id = ?',
      [sharedSessionId]
    );

    const extRes = await request(app)
      .post(`/api/sessions/${sharedSessionId}/extension`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ requestedMinutes: 10, reason: 'Need to review my code thoroughly' });

    expect(extRes.status).toBe(201);
    expect(extRes.body.success).toBe(true);
    expect(extRes.body.data.status).toBe('PENDING');
    expect(extRes.body.data.requestedMinutes).toBe(10);
    expect(extRes.body.data.reason).toBe('Need to review my code thoroughly');
  });

  it('5. Rejects duplicate time extension requests for the same session (409 EXTENSION_ALREADY_REQUESTED)', async () => {
    const dupRes = await request(app)
      .post(`/api/sessions/${sharedSessionId}/extension`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ requestedMinutes: 5, reason: 'Second request attempt' });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('EXTENSION_ALREADY_REQUESTED');
  });

  it('6. Locks answer submissions while time extension request is PENDING (403 EXTENSION_PENDING_ANSWERS_LOCKED)', async () => {
    const qRows = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Questions WHERE exam_id = ? LIMIT 1',
      [examWithExtId]
    );
    const questionId = qRows[0].id;

    const ansRes = await request(app)
      .put(`/api/sessions/${sharedSessionId}/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId, selectedOption: 'B' });

    expect(ansRes.status).toBe(403);
    expect(ansRes.body.error.code).toBe('EXTENSION_PENDING_ANSWERS_LOCKED');
  });

  it('7. GET /api/monitor/extensions returns pending requests with student & exam metrics', async () => {
    const monRes = await request(app)
      .get('/api/monitor/extensions')
      .set('Authorization', `Bearer ${proctorToken}`);

    expect(monRes.status).toBe(200);
    expect(monRes.body.success).toBe(true);
    expect(Array.isArray(monRes.body.data)).toBe(true);

    const pendingItem = monRes.body.data.find(
      (r: Record<string, unknown>) => r.student_email === 'student@proctoriq.io' && r.status === 'PENDING'
    );
    expect(pendingItem).toBeDefined();
    expect(pendingItem.requested_minutes).toBe(10);
    expect(pendingItem.reason).toBe('Need to review my code thoroughly');
    expect(pendingItem.seconds_until_expiry).toBeGreaterThan(0);
  });

  it('8. Proctor approves time extension request -> answers unlock and deadline is extended', async () => {
    const reqRows = await queryRows<RowDataPacket[]>(
      "SELECT request_id, session_id FROM Time_Extension_Requests WHERE status = 'PENDING' LIMIT 1"
    );
    expect(reqRows.length).toBe(1);
    const requestId = reqRows[0].request_id;
    const sessionId = reqRows[0].session_id;

    // Proctor approves with 10 minutes
    const decideRes = await request(app)
      .post(`/api/extensions/${requestId}/decide`)
      .set('Authorization', `Bearer ${proctorToken}`)
      .send({ decision: 'APPROVED', grantedMinutes: 10 });

    expect(decideRes.status).toBe(200);
    expect(decideRes.body.success).toBe(true);
    expect(decideRes.body.data.requestStatus).toBe('APPROVED');
    expect(decideRes.body.data.grantedMinutes).toBe(10);
    expect(decideRes.body.data.extraMinutesGranted).toBe(10);
    expect(decideRes.body.data.secondsRemaining).toBeGreaterThan(500);

    // Verify answers are now UNLOCKED
    const qRows = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Questions WHERE exam_id = ? LIMIT 1',
      [examWithExtId]
    );
    const questionId = qRows[0].id;

    const ansRes = await request(app)
      .put(`/api/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId, selectedOption: 'B' });

    expect(ansRes.status).toBe(200);
    expect(ansRes.body.success).toBe(true);
    expect(ansRes.body.data.selectedOption).toBe('B');
  });

  it('9. Idempotency guard: deciding an already decided request returns 409 ALREADY_DECIDED', async () => {
    const reqRows = await queryRows<RowDataPacket[]>(
      "SELECT request_id FROM Time_Extension_Requests WHERE status = 'APPROVED' LIMIT 1"
    );
    const requestId = reqRows[0].request_id;

    const doubleDecideRes = await request(app)
      .post(`/api/extensions/${requestId}/decide`)
      .set('Authorization', `Bearer ${proctorToken}`)
      .send({ decision: 'APPROVED', grantedMinutes: 10 });

    expect(doubleDecideRes.status).toBe(409);
    expect(doubleDecideRes.body.error.code).toBe('ALREADY_DECIDED');
  });

  it('10. Proctor REJECTS request -> exam ends with TIMED_OUT (not TERMINATED_CHEATING) and real score is preserved', async () => {
    // Create new exam for testing rejection
    const createRejExamRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'API Test Exam: Rejection Test',
        description: 'Testing rejection grading and score preservation invariant.',
        durationMinutes: 10,
        minTrustScore: 60,
        maxExtensionMins: 15,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What is 5 x 5?',
            optionA: '20',
            optionB: '25',
            optionC: '30',
            optionD: '35',
            correctOption: 'B',
            marks: 5,
          },
        ],
      });
    const rejExamId = createRejExamRes.body.data.id;

    // Start session
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: rejExamId });
    const rejSessionId = startRes.body.data.id;

    // Answer the question correctly (Option B, 5 marks)
    const qRows = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Questions WHERE exam_id = ? LIMIT 1',
      [rejExamId]
    );
    const questionId = qRows[0].id;
    await executeSql(
      'INSERT INTO Student_Responses (session_id, question_id, selected_option) VALUES (?, ?, ?)',
      [rejSessionId, questionId, 'B']
    );

    // Fast-forward to 10 seconds remaining
    await executeSql(
      'UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL 10 SECOND) WHERE id = ?',
      [rejSessionId]
    );

    // Request extension
    const extRes = await request(app)
      .post(`/api/sessions/${rejSessionId}/extension`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ requestedMinutes: 5, reason: 'Need extra time on rejection test' });
    const requestId = extRes.body.data.requestId;

    // Proctor REJECTS request
    const rejectRes = await request(app)
      .post(`/api/extensions/${requestId}/decide`)
      .set('Authorization', `Bearer ${proctorToken}`)
      .send({ decision: 'REJECTED' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.success).toBe(true);
    expect(rejectRes.body.data.requestStatus).toBe('REJECTED');

    // Check Exam_Sessions status: MUST be TIMED_OUT, NOT TERMINATED_CHEATING
    const sessRows = await queryRows<RowDataPacket[]>(
      'SELECT status, trust_score FROM Exam_Sessions WHERE id = ?',
      [rejSessionId]
    );
    expect(sessRows[0].status).toBe('TIMED_OUT');

    // Check Results table: score must be preserved (5 marks, NOT 0), and integrity status must NOT be DISQUALIFIED
    const resultRows = await queryRows<RowDataPacket[]>(
      'SELECT raw_score, total_marks, percentage, integrity_status FROM Results WHERE session_id = ?',
      [rejSessionId]
    );
    expect(resultRows.length).toBe(1);
    expect(Number(resultRows[0].raw_score)).toBe(5);
    expect(Number(resultRows[0].total_marks)).toBe(5);
    expect(Number(resultRows[0].percentage)).toBe(100);
    expect(resultRows[0].integrity_status).not.toBe('DISQUALIFIED');

    // Clean up
    await executeSql('DELETE FROM Exams WHERE id = ?', [rejExamId]);
  });

  it('11. sp_AutoTimeoutExpiredSessions skips sessions with active unexpired PENDING requests', async () => {
    // Create new exam for timeout testing
    const createTimeoutExamRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'API Test Exam: Auto Timeout Test',
        description: 'Testing sp_AutoTimeoutExpiredSessions bypass and expiration rules.',
        durationMinutes: 10,
        minTrustScore: 60,
        maxExtensionMins: 15,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What is 10 / 2?',
            optionA: '2',
            optionB: '5',
            optionC: '10',
            optionD: '20',
            correctOption: 'B',
            marks: 5,
          },
        ],
      });
    const timeoutExamId = createTimeoutExamRes.body.data.id;

    // Start session
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: timeoutExamId });
    const sessId = startRes.body.data.id;

    // Fast-forward started_at and deadline so session is past its duration
    await executeSql(
      `UPDATE Exam_Sessions
          SET started_at = DATE_SUB(NOW(), INTERVAL 15 MINUTE),
              server_deadline = DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        WHERE id = ?`,
      [sessId]
    );

    // Add active PENDING request created 30 seconds ago (< 180s)
    await executeSql(
      `INSERT INTO Time_Extension_Requests (session_id, requested_minutes, reason, status, created_at)
       VALUES (?, 5, 'Pending test', 'PENDING', DATE_SUB(NOW(), INTERVAL 30 SECOND))`,
      [sessId]
    );

    // Run sp_AutoTimeoutExpiredSessions
    await pool.query('CALL sp_AutoTimeoutExpiredSessions()');

    // Verify session remains IN_PROGRESS because request is pending and unexpired
    const checkRows = await queryRows<RowDataPacket[]>(
      'SELECT status FROM Exam_Sessions WHERE id = ?',
      [sessId]
    );
    expect(checkRows[0].status).toBe('IN_PROGRESS');

    // Now age the request past 180 seconds (3 mins)
    await executeSql(
      'UPDATE Time_Extension_Requests SET created_at = DATE_SUB(NOW(), INTERVAL 200 SECOND) WHERE session_id = ?',
      [sessId]
    );

    // Re-run sp_AutoTimeoutExpiredSessions
    await pool.query('CALL sp_AutoTimeoutExpiredSessions()');

    // Verify request is now EXPIRED and session is TIMED_OUT
    const reqRows = await queryRows<RowDataPacket[]>(
      'SELECT status FROM Time_Extension_Requests WHERE session_id = ?',
      [sessId]
    );
    expect(reqRows[0].status).toBe('EXPIRED');

    const timeoutRows = await queryRows<RowDataPacket[]>(
      'SELECT status FROM Exam_Sessions WHERE id = ?',
      [sessId]
    );
    expect(timeoutRows[0].status).toBe('TIMED_OUT');

    // Clean up
    await executeSql('DELETE FROM Exams WHERE id = ?', [timeoutExamId]);
  });
});
