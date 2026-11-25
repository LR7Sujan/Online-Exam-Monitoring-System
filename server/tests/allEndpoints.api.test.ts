import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { executeSql, queryRows } from '../src/config/db.js';
import { env } from '../src/config/env.js';

describe('Comprehensive API Endpoint Test Suite (All Endpoints: 200/201, 400, 401, 403, 404)', () => {
  const app = createApp();

  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let studentId: number;

  let otherStudentToken: string;
  let otherStudentId: number;

  let testExamId: number;
  let testQuestionId: number;
  let testSessionId: number;

  beforeAll(async () => {
    // 1. Obtain admin token
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // 2. Obtain proctor token
    const proctorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' });
    expect(proctorRes.status).toBe(200);
    proctorToken = proctorRes.body.data.token;

    // 3. Register primary test student
    const studentEmail = `api.test.student.${Date.now()}@proctoriq.io`;
    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Primary API Student',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      });
    expect(studentRes.status).toBe(201);
    studentToken = studentRes.body.data.token;
    studentId = studentRes.body.data.user.id;

    // 4. Register secondary test student (for access-control tests)
    const otherEmail = `api.test.other.${Date.now()}@proctoriq.io`;
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Secondary API Student',
        email: otherEmail,
        password: 'ProctorIQ#2026',
      });
    expect(otherRes.status).toBe(201);
    otherStudentToken = otherRes.body.data.token;
    otherStudentId = otherRes.body.data.user.id;

    // 5. Create a dedicated test exam
    const examRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Comprehensive API Test Exam',
        description: 'Exam used for automated endpoint test coverage and integrity',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 7200000).toISOString(),
        isPublished: false,
        questions: [
          {
            questionText: 'Initial Comprehensive Question',
            optionA: 'Opt A',
            optionB: 'Opt B',
            correctOption: 'A',
            marks: 1,
          },
        ],
      });
    expect(examRes.status).toBe(201);
    testExamId = examRes.body.data.id;

    // 6. Add questions to test exam (allowed while draft)
    const qRes = await request(app)
      .post(`/api/exams/${testExamId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'Which guarantee does ACID Durability enforce?',
        optionA: 'Writes persist across crashes',
        optionB: 'Locks are dropped early',
        optionC: 'Cache bypass',
        optionD: 'Memory only state',
        correctOption: 'A',
        marks: 2.5,
        orderIndex: 1,
      });
    expect(qRes.status).toBe(201);
    testQuestionId = qRes.body.data.id;

    // Publish exam so students can start sessions
    const pubRes = await request(app)
      .patch(`/api/exams/${testExamId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pubRes.status).toBe(200);

    // 7. Start an active session for primary student
    const sessRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .set('x-device-fingerprint', 'device-primary-123')
      .set('x-session-token', 'token-primary-123')
      .send({
        examId: testExamId,
        deviceFingerprint: 'device-primary-123',
        sessionToken: 'token-primary-123',
      });
    expect([200, 201]).toContain(sessRes.status);
    testSessionId = sessRes.body.data.id || sessRes.body.data.session?.id;
    expect(testSessionId).toBeDefined();
  });

  afterAll(async () => {
    // Clean up created entities
    if (testExamId) {
      await executeSql('DELETE FROM Exams WHERE id = ?', [testExamId]);
    }
    if (studentId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [studentId]);
    }
    if (otherStudentId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [otherStudentId]);
    }
  });

  // ==========================================================================
  // FOCUS AREA 1: AUTHENTICATION & TOKEN AUDIT
  // ==========================================================================
  describe('Focus Area 1: Auth Endpoints & Token Security', () => {
    it('POST /api/auth/register - 201 success', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Fresh Candidate',
          email: `candidate.${Date.now()}@proctoriq.io`,
          password: 'ProctorIQ#2026',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('STUDENT');
    });

    it('POST /api/auth/register - 400 validation failure (short password < 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Weak Password Candidate',
          email: `weak.${Date.now()}@proctoriq.io`,
          password: 'short',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/register - 400 validation failure (invalid email format)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Invalid Email',
          email: 'not-an-email',
          password: 'ProctorIQ#2026',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/register - 409 duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Duplicate Admin',
          email: 'admin@proctoriq.io',
          password: 'ProctorIQ#2026',
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/login - 200 success', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('POST /api/auth/login - 401 invalid credentials (wrong password)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@proctoriq.io', password: 'WrongPassword#999' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/login - 401 invalid credentials (unknown email)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@proctoriq.io', password: 'ProctorIQ#2026' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/login - 400 validation failure (missing password)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@proctoriq.io' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/auth/me - 200 success', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBeDefined();
      expect(res.body.data.role).toBe('STUDENT');
    });

    it('GET /api/auth/me - 401 missing token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/auth/me - 401 tampered JWT signature', async () => {
      const tampered = studentToken.slice(0, -6) + 'abcdef';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tampered}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/auth/me - 401 expired JWT', async () => {
      const expiredToken = jwt.sign(
        { sub: 1, email: 'expired@proctoriq.io', role: 'STUDENT', fullName: 'Expired User' },
        env.JWT_SECRET,
        { expiresIn: '-10s' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // FOCUS AREA 2: EXAM START & WINDOW VALIDATION
  // ==========================================================================
  describe('Focus Area 2: Exam Start Window & Device Fingerprint Concurrency', () => {
    let futureExamId: number;
    let pastExamId: number;

    beforeAll(async () => {
      // Create future exam (window not open yet)
      const fRes = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Future Window Exam',
          description: 'Syllabus and guidelines for future window assessment testing',
          durationMinutes: 60,
          minTrustScore: 50,
          startWindow: new Date(Date.now() + 3600000).toISOString(),
          endWindow: new Date(Date.now() + 7200000).toISOString(),
          isPublished: true,
          questions: [
            {
              questionText: 'Future Question 1',
              optionA: 'Opt A',
              optionB: 'Opt B',
              correctOption: 'A',
              marks: 1,
            },
          ],
        });
      futureExamId = fRes.body.data.id;

      // Create past exam (window already closed)
      const pRes = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Past Window Exam',
          description: 'Syllabus and guidelines for past window assessment testing',
          durationMinutes: 60,
          minTrustScore: 50,
          startWindow: new Date(Date.now() - 7200000).toISOString(),
          endWindow: new Date(Date.now() - 3600000).toISOString(),
          isPublished: true,
          questions: [
            {
              questionText: 'Past Question 1',
              optionA: 'Opt A',
              optionB: 'Opt B',
              correctOption: 'A',
              marks: 1,
            },
          ],
        });
      pastExamId = pRes.body.data.id;
    });

    afterAll(async () => {
      if (futureExamId) await executeSql('DELETE FROM Exams WHERE id = ?', [futureExamId]);
      if (pastExamId) await executeSql('DELETE FROM Exams WHERE id = ?', [pastExamId]);
    });

    it('POST /api/sessions/start - 409 when exam window has not opened yet', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ examId: futureExamId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EXAM_WINDOW_CLOSED');
    });

    it('POST /api/sessions/start - 409 when exam window has already closed', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ examId: pastExamId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EXAM_WINDOW_CLOSED');
    });

    it('POST /api/sessions/start - 200/201 inside open window', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .set('x-device-fingerprint', 'fp-device-A')
        .set('x-session-token', 'tok-device-A')
        .send({
          examId: testExamId,
          deviceFingerprint: 'fp-device-A',
          sessionToken: 'tok-device-A',
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/sessions/start - 200 idempotent resume from same device/browser', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .set('x-device-fingerprint', 'fp-device-A')
        .set('x-session-token', 'tok-device-A')
        .send({
          examId: testExamId,
          deviceFingerprint: 'fp-device-A',
          sessionToken: 'tok-device-A',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/sessions/start - 409 conflict when starting from a different device fingerprint', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .set('x-device-fingerprint', 'fp-device-DIFFERENT')
        .set('x-session-token', 'tok-device-DIFFERENT')
        .send({
          examId: testExamId,
          deviceFingerprint: 'fp-device-DIFFERENT',
          sessionToken: 'tok-device-DIFFERENT',
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_CONFLICT');
    });

    it('POST /api/sessions/start - 403 wrong role (PROCTOR or ADMIN attempting candidate session)', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({ examId: testExamId });
      expect(res.status).toBe(403);
    });

    it('POST /api/sessions/start - 404 non-existent examId', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ examId: 999999 });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // FOCUS AREA 3: QUESTIONS ENDPOINT & ANSWER-KEY LEAK PREVENTION
  // ==========================================================================
  describe('Focus Area 3: Questions Endpoint & Security Leak Auditing', () => {
    it('GET /api/sessions/:sessionId/questions - 200 returns questions without correct_option', async () => {
      const res = await request(app)
        .get(`/api/sessions/${testSessionId}/questions`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const questions = res.body.data.questions;
      expect(questions.length).toBeGreaterThan(0);
      for (const q of questions) {
        expect(q.correct_option).toBeUndefined();
        expect(q.correctOption).toBeUndefined();
      }
    });

    it('GET /api/sessions/:sessionId - 200 returns session payload with stripped correct_option', async () => {
      const res = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      const questions = res.body.data.questions;
      for (const q of questions) {
        expect(q.correct_option).toBeUndefined();
        expect(q.correctOption).toBeUndefined();
      }
    });

    it('GET /api/exams/:id/questions - 403 blocks student role-bypass attempt', async () => {
      const res = await request(app)
        .get(`/api/exams/${testExamId}/questions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ includeAnswers: 'true', role: 'ADMIN' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/exams/:id/questions - 200 allowed for ADMIN role with correct_option for authoring', async () => {
      const res = await request(app)
        .get(`/api/exams/${testExamId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].correct_option).toBe('A');
    });

    it('GET /api/sessions/:sessionId/questions - 403 student cannot access other student session', async () => {
      const res = await request(app)
        .get(`/api/sessions/${testSessionId}/questions`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/sessions/:sessionId/questions - 404 for non-existent session', async () => {
      const res = await request(app)
        .get('/api/sessions/999999/questions')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // FOCUS AREA 4: ANSWER UPSERT & IMMUTABILITY
  // ==========================================================================
  describe('Focus Area 4: Answer UPSERT & Session Lifecycle Invariants', () => {
    it('POST /api/sessions/:sessionId/response - 200 saves first answer', async () => {
      const res = await request(app)
        .post(`/api/sessions/${testSessionId}/response`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'A',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.selectedOption).toBe('A');

      const rows = await queryRows<RowDataPacket[]>(
        'SELECT selected_option FROM Student_Responses WHERE session_id = ? AND question_id = ?',
        [testSessionId, testQuestionId]
      );
      expect(rows.length).toBe(1);

      const [sess] = await queryRows<RowDataPacket[]>(
        'SELECT option_maps FROM Exam_Sessions WHERE id = ?',
        [testSessionId]
      );
      const oMap = (typeof sess.option_maps === 'string' ? JSON.parse(sess.option_maps) : sess.option_maps)?.[String(testQuestionId)] || ['A', 'B', 'C', 'D'];
      expect(rows[0].selected_option).toBe(oMap[0]);
    });

    it('POST /api/sessions/:sessionId/response - 200 UPSERT changes answer without duplicating row', async () => {
      const res = await request(app)
        .post(`/api/sessions/${testSessionId}/response`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'B',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.selectedOption).toBe('B');

      const rows = await queryRows<RowDataPacket[]>(
        'SELECT selected_option FROM Student_Responses WHERE session_id = ? AND question_id = ?',
        [testSessionId, testQuestionId]
      );
      expect(rows.length).toBe(1); // Row count MUST remain 1

      const [sess] = await queryRows<RowDataPacket[]>(
        'SELECT option_maps FROM Exam_Sessions WHERE id = ?',
        [testSessionId]
      );
      const oMap = (typeof sess.option_maps === 'string' ? JSON.parse(sess.option_maps) : sess.option_maps)?.[String(testQuestionId)] || ['A', 'B', 'C', 'D'];
      expect(rows[0].selected_option).toBe(oMap[1]);
    });

    it('POST /api/sessions/:sessionId/response - 400 validation failure (invalid option Z)', async () => {
      const res = await request(app)
        .post(`/api/sessions/${testSessionId}/response`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'Z',
        });
      expect(res.status).toBe(400);
    });

    it('POST /api/sessions/:sessionId/response - 403 student cannot answer for another student session', async () => {
      const res = await request(app)
        .post(`/api/sessions/${testSessionId}/response`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'A',
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/sessions/:sessionId/response - 404 non-existent session', async () => {
      const res = await request(app)
        .post('/api/sessions/999999/response')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'A',
        });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // FOCUS AREA 5: VIOLATION ENDPOINT, DEBOUNCE & RATE LIMITING
  // ==========================================================================
  describe('Focus Area 5: Violation Reporting, Trust Decay & Debounce', () => {
    it('POST /api/violations - 200 records violation and returns decayed trust score', async () => {
      const res = await request(app)
        .post('/api/violations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sessionId: testSessionId,
          violationCode: 'TAB_SWITCH',
          evidenceMeta: { test: 'blur_event' },
        });
      expect(res.status).toBe(200);
      expect(res.body.data.trustScore).toBeLessThan(100);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('POST /api/violations - 200 debounces identical violation within 3 seconds', async () => {
      const res = await request(app)
        .post('/api/violations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sessionId: testSessionId,
          violationCode: 'TAB_SWITCH',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.debounced).toBe(true);
    });

    it('POST /api/violations - 400 rejects invalid/unknown violation code', async () => {
      const res = await request(app)
        .post('/api/violations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sessionId: testSessionId,
          violationCode: 'UNKNOWN_INVALID_VIOLATION_CODE',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VIOLATION_CODE');
    });

    it('POST /api/violations - 403 student cannot report violation on another student session', async () => {
      const res = await request(app)
        .post('/api/violations')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({
          sessionId: testSessionId,
          violationCode: 'NO_FACE',
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/violations - 401 missing token', async () => {
      const res = await request(app)
        .post('/api/violations')
        .send({
          sessionId: testSessionId,
          violationCode: 'NO_FACE',
        });
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // FOCUS AREA 6: SUBMIT & CONCURRENT DOUBLE-SUBMIT IDEMPOTENCY
  // ==========================================================================
  describe('Focus Area 6: Exam Submission & Anti-Double-Submit Guarantees', () => {
    it('POST /api/sessions/:sessionId/submit - concurrent double submit creates exactly ONE Results row', async () => {
      // Execute 3 simultaneous submit calls concurrently
      const promises = [
        request(app).post(`/api/sessions/${testSessionId}/submit`).set('Authorization', `Bearer ${studentToken}`),
        request(app).post(`/api/sessions/${testSessionId}/submit`).set('Authorization', `Bearer ${studentToken}`),
        request(app).post(`/api/sessions/${testSessionId}/submit`).set('Authorization', `Bearer ${studentToken}`),
      ];

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.result).toBeDefined();
      }

      // Verify exactly ONE row in Results table
      const rows = await queryRows<RowDataPacket[]>(
        'SELECT id, session_id, raw_score, integrity_status FROM Results WHERE session_id = ?',
        [testSessionId]
      );
      expect(rows.length).toBe(1);
    });

    it('POST /api/sessions/:sessionId/response - 409 rejects answer after session has submitted', async () => {
      const res = await request(app)
        .post(`/api/sessions/${testSessionId}/response`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: testQuestionId,
          selectedOption: 'C',
        });
      // Database trigger raises 45000, mapped to 409
      expect([400, 409]).toContain(res.status);
    });

    it('GET /api/sessions/:sessionId/result - 200 returns graded result certificate', async () => {
      const res = await request(app)
        .get(`/api/sessions/${testSessionId}/result`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.result.session_id).toBe(testSessionId);
      expect(res.body.data.result.total_marks).toBeDefined();
    });

    it('GET /api/sessions/:sessionId/result - 403 other student cannot view result', async () => {
      const res = await request(app)
        .get(`/api/sessions/${testSessionId}/result`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // FOCUS AREA 7: TIMER & SERVER-CLOCK DEADLINES
  // ==========================================================================
  describe('Focus Area 7: Timer Synchronization & Server Deadlines', () => {
    it('GET /api/sessions/:sessionId/time-left - 200 returns seconds_remaining and server_time', async () => {
      const res = await request(app)
        .get(`/api/sessions/${testSessionId}/time-left`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.serverTime).toBeDefined();
      expect(res.body.data.serverDeadline).toBeDefined();
      expect(typeof res.body.data.secondsRemaining).toBe('number');
    });

    it('GET /api/sessions/:sessionId/time-left - 401 missing token', async () => {
      const res = await request(app).get(`/api/sessions/${testSessionId}/time-left`);
      expect(res.status).toBe(401);
    });

    it('GET /api/sessions/:sessionId/time-left - 404 for non-existent session', async () => {
      const res = await request(app)
        .get('/api/sessions/999999/time-left')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // FOCUS AREA 8: PROCTOR & ADMIN CONTROLS & ANALYTICS
  // ==========================================================================
  describe('Focus Area 8: Proctor & Admin Control Center Endpoints', () => {
    let proctorTestLogId: number;

    beforeAll(async () => {
      // Pick a PENDING log so that transitioning to CONFIRMED is a valid state transition
      const logs = await queryRows<RowDataPacket[]>(
        "SELECT id FROM Proctoring_Logs WHERE proctor_review_status = 'PENDING' LIMIT 1"
      );
      if (logs[0]?.id) {
        proctorTestLogId = logs[0].id;
      } else {
        const ins = await executeSql(
          "INSERT INTO Proctoring_Logs (session_id, violation_type_id, proctor_review_status) VALUES (?, 1, 'PENDING')",
          [testSessionId]
        );
        proctorTestLogId = ins.insertId;
      }
    });

    // Proctor Routes
    it('GET /api/proctor/sessions - 200 returns filtered sessions for PROCTOR', async () => {
      const res = await request(app)
        .get('/api/proctor/sessions')
        .set('Authorization', `Bearer ${proctorToken}`)
        .query({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
    });

    it('GET /api/proctor/sessions - 403 blocked for STUDENT role', async () => {
      const res = await request(app)
        .get('/api/proctor/sessions')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/proctor/logs - 200 returns audit logs for PROCTOR', async () => {
      const res = await request(app)
        .get('/api/proctor/logs')
        .set('Authorization', `Bearer ${proctorToken}`)
        .query({ status: 'PENDING' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.logs)).toBe(true);
    });

    it('PATCH /api/proctor/logs/:logId/review - 200 reviews log (CONFIRMED)', async () => {
      const res = await request(app)
        .patch(`/api/proctor/logs/${proctorTestLogId}/review`)
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({
          reviewStatus: 'CONFIRMED',
          reviewNotes: 'Proctor confirmed telemetry violation via test suite.',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.proctor_review_status).toBe('CONFIRMED');
    });

    it('PATCH /api/proctor/logs/:logId/review - 400 validation failure (invalid status)', async () => {
      const res = await request(app)
        .patch(`/api/proctor/logs/${proctorTestLogId}/review`)
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({ reviewStatus: 'INVALID_STATUS' });
      expect(res.status).toBe(400);
    });

    it('PATCH /api/proctor/logs/:logId/review - 404 for non-existent logId', async () => {
      const res = await request(app)
        .patch('/api/proctor/logs/999999/review')
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({ reviewStatus: 'CONFIRMED' });
      expect(res.status).toBe(404);
    });

    it('POST /api/proctor/sessions/:sessionId/message - 200 sends proctor warning message', async () => {
      const res = await request(app)
        .post(`/api/proctor/sessions/${testSessionId}/message`)
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({
          message: 'Please keep your face directly centered in your webcam frame.',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.delivered).toBe(true);
    });

    it('POST /api/proctor/sessions/:sessionId/message - 400 validation failure (empty message)', async () => {
      const res = await request(app)
        .post(`/api/proctor/sessions/${testSessionId}/message`)
        .set('Authorization', `Bearer ${proctorToken}`)
        .send({ message: '' });
      expect(res.status).toBe(400);
    });

    // Admin & Analytics Endpoints
    it('GET /api/analytics/overview - 200 returns totals matching database', async () => {
      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalExams).toBeGreaterThan(0);
      expect(res.body.data.totalSessions).toBeGreaterThan(0);
      expect(res.body.data.totalViolations).toBeGreaterThan(0);
    });

    it('GET /api/analytics/overview - 403 blocks STUDENT role', async () => {
      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/analytics/heatmap - 200 returns hourly violation heatmap', async () => {
      const res = await request(app)
        .get('/api/analytics/heatmap')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const totalViolations = res.body.data.reduce(
        (sum: number, r: { violation_count: number }) => sum + Number(r.violation_count),
        0
      );
      expect(totalViolations).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/analytics/heatmap?days=7 - 200 returns last 7 days heatmap records', async () => {
      const res = await request(app)
        .get('/api/analytics/heatmap?days=7')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const totalViolations = res.body.data.reduce(
        (sum: number, r: { violation_count: number }) => sum + Number(r.violation_count),
        0
      );
      expect(totalViolations).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/analytics/heatmap?days=invalid - 400 rejects invalid days parameter', async () => {
      const res = await request(app)
        .get('/api/analytics/heatmap?days=99')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    // Dashboard & Violations Telemetry Tests (7 vs 30 days window)
    it('GET /api/analytics/dashboard?days=7 - 200 returns exactly 7 continuous points and matches direct SQL query', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .query({ days: 7 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const points = res.body.data.violationsOverTime;
      expect(Array.isArray(points)).toBe(true);
      expect(points.length).toBe(7);

      // Verify continuous date order (each date is exactly 1 day after previous)
      for (let i = 1; i < points.length; i++) {
        const prev = new Date(points[i - 1].date + 'T00:00:00Z').getTime();
        const curr = new Date(points[i].date + 'T00:00:00Z').getTime();
        expect(curr - prev).toBe(86400000);
      }

      // Verify summary fields
      const summary = res.body.data.violationsSummary;
      expect(summary).toBeDefined();
      expect(summary.total).toBeGreaterThan(0);
      expect(summary.dailyAverage).toBe(Number((summary.total / 7).toFixed(1)));
      expect(typeof summary.peakDate).toBe('string');
      expect(summary.peakCount).toBeGreaterThanOrEqual(0);

      // Verify total matches direct SQL query
      const [sqlRow] = await queryRows<RowDataPacket[]>(
        'SELECT COUNT(*) AS total_count FROM Proctoring_Logs WHERE occurred_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)'
      );
      expect(summary.total).toBe(Number(sqlRow.total_count));
    });

    it('GET /api/analytics/dashboard?days=30 - 200 returns exactly 30 continuous points and matches direct SQL query', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .query({ days: 30 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const points = res.body.data.violationsOverTime;
      expect(Array.isArray(points)).toBe(true);
      expect(points.length).toBe(30);

      // Verify continuous date order
      for (let i = 1; i < points.length; i++) {
        const prev = new Date(points[i - 1].date + 'T00:00:00Z').getTime();
        const curr = new Date(points[i].date + 'T00:00:00Z').getTime();
        expect(curr - prev).toBe(86400000);
      }

      const summary = res.body.data.violationsSummary;
      expect(summary.total).toBeGreaterThanOrEqual(1);
      expect(summary.dailyAverage).toBe(Number((summary.total / 30).toFixed(1)));

      // Verify total matches direct SQL query
      const [sqlRow] = await queryRows<RowDataPacket[]>(
        'SELECT COUNT(*) AS total_count FROM Proctoring_Logs WHERE occurred_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)'
      );
      expect(summary.total).toBe(Number(sqlRow.total_count));
    });

    it('GET /api/analytics/dashboard?days=14 - 400 rejects invalid days window with validation error', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .query({ days: 14 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/analytics/dashboard?days=abc - 400 rejects non-numeric days param', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .query({ days: 'abc' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/analytics/violations-over-time - 200 returns 7 continuous points by default', async () => {
      const res = await request(app)
        .get('/api/analytics/violations-over-time')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.violationsOverTime.length).toBe(7);
      expect(res.body.data.summary.total).toBeGreaterThan(0);
    });

    it('GET /api/admin/users - 200 returns user list for ADMIN', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ role: 'STUDENT' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/admin/users - 403 blocks PROCTOR role', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${proctorToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/system-stats - 200 returns table counts & health', async () => {
      const res = await request(app)
        .get('/api/admin/system-stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.tableCounts.Users).toBeGreaterThan(0);
      expect(res.body.data.tableCounts.Exams).toBeGreaterThan(0);
    });

    // Violation Types CRUD (Admin)
    let createdVtId: number;

    it('POST /api/violation-types - 201 ADMIN creates violation type', async () => {
      const code = `CUSTOM_VIOLATION_${Date.now()}`;
      const res = await request(app)
        .post('/api/violation-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          label: 'Custom Automated Violation',
          description: 'Created during automated API test suite',
          penaltyPoints: 25,
          severity: 'HIGH',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe(code);
      createdVtId = res.body.data.id;
    });

    it('POST /api/violation-types - 400 validation failure (penaltyPoints < 1)', async () => {
      const res = await request(app)
        .post('/api/violation-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'ZERO_PENALTY',
          label: 'Zero Penalty',
          penaltyPoints: 0,
          severity: 'LOW',
        });
      expect(res.status).toBe(400);
    });

    it('PUT /api/violation-types/:id - 200 ADMIN updates violation type', async () => {
      const res = await request(app)
        .put(`/api/violation-types/${createdVtId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description for automated test',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated description for automated test');
    });

    it('DELETE /api/violation-types/:id - 200 ADMIN deletes violation type', async () => {
      const res = await request(app)
        .delete(`/api/violation-types/${createdVtId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('DELETE /api/violation-types/:id - 404 for non-existent violation type', async () => {
      const res = await request(app)
        .delete('/api/violation-types/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
