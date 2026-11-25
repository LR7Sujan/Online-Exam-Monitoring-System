import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { executeSql, pool, queryRows } from '../src/config/db.js';
import { clearViolationDebounceCache } from '../src/services/violationGuard.js';
import type { SessionWarningRow } from '../src/types/api.js';

describe('Warning Gate & New Violation Types: Invariant & API Tests', () => {
  const app = createApp();

  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let studentId: number;
  let otherStudentId: number;
  let testExamId: number;
  let sessionId: number;

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

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    studentToken = studentRes.body.data.token;
    studentId = studentRes.body.data.user.id;
    void studentId;

    // Register a secondary student for cross-tenant auth verification
    const otherEmail = `other.student.${Date.now()}@proctoriq.io`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: otherEmail,
        password: 'Password123!',
        fullName: 'Other Student User',
        role: 'STUDENT',
      });
    otherStudentToken = regRes.body.data.token;
    otherStudentId = regRes.body.data.user.id;

    // 2. Create test exam (min_trust_score: 50, duration: 60)
    const createExamRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Warning Gate Test Exam ${Date.now()}`,
        description: 'Comprehensive test exam for warning gate and phone/voice violation types.',
        durationMinutes: 60,
        minTrustScore: 50,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'Is warning gating active?',
            optionA: 'Yes',
            optionB: 'No',
            optionC: 'Maybe',
            optionD: 'Never',
            correctOption: 'A',
            marks: 10,
          },
        ],
      });
    testExamId = createExamRes.body.data.id;

    // 3. Start exam session for student
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: testExamId });
    sessionId = startRes.body.data.id;
  });

  afterAll(async () => {
    // Cleanup created test records (Proctoring_Logs is immutable by trigger, so delete session warnings and users)
    if (sessionId) {
      await executeSql('DELETE FROM Session_Warnings WHERE session_id = ?', [sessionId]);
    }
    if (otherStudentId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [otherStudentId]);
    }
  });

  it('verifies PHONE_DETECTED and VOICE_DETECTED exist with correct penalties in Violation_Types', async () => {
    const rows = await queryRows<RowDataPacket[]>(
      'SELECT code, label, penalty_points, severity FROM Violation_Types WHERE code IN (?, ?)',
      ['PHONE_DETECTED', 'VOICE_DETECTED']
    );

    expect(rows).toHaveLength(2);
    const phone = rows.find((r) => r.code === 'PHONE_DETECTED');
    const voice = rows.find((r) => r.code === 'VOICE_DETECTED');

    expect(phone).toBeDefined();
    expect(phone?.penalty_points).toBe(25);
    expect(phone?.severity).toBe('HIGH');

    expect(voice).toBeDefined();
    expect(voice?.penalty_points).toBe(15);
    expect(voice?.severity).toBe('MEDIUM');
  });

  it('records initial PHONE_DETECTED violation, deducts 25 points, and issues warning', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/violation`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        code: 'PHONE_DETECTED',
        evidenceMeta: { confidence: 0.94 },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('PHONE_DETECTED');
    expect(res.body.data.penaltyApplied).toBe(25);
    expect(res.body.data.trust_score).toBe(75);
    expect(res.body.data.warning).toBeDefined();
    expect(res.body.data.warning.violationCode).toBe('PHONE_DETECTED');
    expect(res.body.data.warning.penaltyPoints).toBe(25);
    expect(res.body.data.warning.trustScoreAfter).toBe(75);
    expect(res.body.data.warning.warningCount).toBe(1);

    // Verify DB state
    const [sessRows] = await pool.query<RowDataPacket[]>(
      'SELECT trust_score, pending_warning_log_id, warning_count FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sessRows[0].trust_score).toBe(75);
    expect(sessRows[0].pending_warning_log_id).toBe(res.body.data.logId);
    expect(sessRows[0].warning_count).toBe(1);

    // Verify Session_Warnings row
    const [warnRows] = await pool.query<SessionWarningRow[]>(
      'SELECT * FROM Session_Warnings WHERE session_id = ?',
      [sessionId]
    );
    expect(warnRows).toHaveLength(1);
    expect(warnRows[0].violation_code).toBe('PHONE_DETECTED');
    expect(warnRows[0].penalty_points).toBe(25);
    expect(warnRows[0].trust_score_after).toBe(75);
    expect(warnRows[0].acknowledged_at).toBeNull();
  });

  it('ignores subsequent violations while pending warning is unacknowledged', async () => {
    // Attempt VOICE_DETECTED while PHONE_DETECTED warning is pending
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/violation`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        code: 'VOICE_DETECTED',
        evidenceMeta: { decibels: 85 },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ignored).toBe(true);
    expect(res.body.data.reason).toBe('WARNING_PENDING');
    expect(res.body.data.trust_score).toBe(75); // Unchanged!

    // Ensure NO additional log was inserted
    const [logRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM Proctoring_Logs WHERE session_id = ?',
      [sessionId]
    );
    expect(logRows[0].total).toBe(1);

    // Ensure trust score in DB remained 75
    const [sessRows] = await pool.query<RowDataPacket[]>(
      'SELECT trust_score FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sessRows[0].trust_score).toBe(75);
  });

  it('rejects acknowledgment by an unauthorized student', async () => {
    const [warnRows] = await pool.query<SessionWarningRow[]>(
      'SELECT warning_id FROM Session_Warnings WHERE session_id = ?',
      [sessionId]
    );
    const warningId = warnRows[0].warning_id;

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/warnings/${warningId}/ack`)
      .set('Authorization', `Bearer ${otherStudentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('acknowledges warning successfully, clearing pending flag and stamping last_warning_ack_at', async () => {
    const [warnRows] = await pool.query<SessionWarningRow[]>(
      'SELECT warning_id FROM Session_Warnings WHERE session_id = ?',
      [sessionId]
    );
    const warningId = warnRows[0].warning_id;

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/warnings/${warningId}/ack`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.acknowledged).toBe(true);
    expect(res.body.data.warningId).toBe(warningId);
    expect(res.body.data.graceSeconds).toBe(5);

    // Verify DB state
    const [sessRows] = await pool.query<RowDataPacket[]>(
      'SELECT pending_warning_log_id, last_warning_ack_at FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sessRows[0].pending_warning_log_id).toBeNull();
    expect(sessRows[0].last_warning_ack_at).not.toBeNull();

    // Verify Session_Warnings marked acknowledged
    const [updatedWarn] = await pool.query<SessionWarningRow[]>(
      'SELECT acknowledged_at FROM Session_Warnings WHERE warning_id = ?',
      [warningId]
    );
    expect(updatedWarn[0].acknowledged_at).not.toBeNull();
  });

  it('is idempotent on duplicate acknowledgment', async () => {
    const [warnRows] = await pool.query<SessionWarningRow[]>(
      'SELECT warning_id FROM Session_Warnings WHERE session_id = ?',
      [sessionId]
    );
    const warningId = warnRows[0].warning_id;

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/warnings/${warningId}/ack`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.acknowledged).toBe(true);
    expect(res.body.data.alreadyAcknowledged).toBe(true);
  });

  it('ignores violations during the 5-second grace window after acknowledgment', async () => {
    clearViolationDebounceCache();

    // Immediately fire another violation within 5s grace window
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/violation`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        code: 'VOICE_DETECTED',
        evidenceMeta: { speechDetected: true },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ignored).toBe(true);
    expect(res.body.data.reason).toBe('WARNING_GRACE');
    expect(res.body.data.trust_score).toBe(75); // No deduction
  });

  it('processes violation once grace period has elapsed', async () => {
    // Fast-forward last_warning_ack_at to 10 seconds ago
    await executeSql(
      'UPDATE Exam_Sessions SET last_warning_ack_at = DATE_SUB(NOW(), INTERVAL 10 SECOND) WHERE id = ?',
      [sessionId]
    );

    clearViolationDebounceCache();

    // Fire VOICE_DETECTED (15 pts deduction: 75 -> 60)
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/violation`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        code: 'VOICE_DETECTED',
        evidenceMeta: { speechConfidence: 0.88 },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('VOICE_DETECTED');
    expect(res.body.data.penaltyApplied).toBe(15);
    expect(res.body.data.trust_score).toBe(60);
    expect(res.body.data.warning.warningCount).toBe(2);

    // Verify DB warning count
    const [sessRows] = await pool.query<RowDataPacket[]>(
      'SELECT trust_score, warning_count FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sessRows[0].trust_score).toBe(60);
    expect(sessRows[0].warning_count).toBe(2);
  });

  it('returns complete warning history in GET /api/sessions/:sessionId/warnings', async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionId}/warnings`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    expect(res.body.data[0].violation_code).toBe('PHONE_DETECTED');
    expect(res.body.data[0].penalty_points).toBe(25);
    expect(res.body.data[0].acknowledged_at).not.toBeNull();

    expect(res.body.data[1].violation_code).toBe('VOICE_DETECTED');
    expect(res.body.data[1].penalty_points).toBe(15);
    expect(res.body.data[1].acknowledged_at).toBeNull();

    // Verify proctor can also view warnings
    const proctorRes = await request(app)
      .get(`/api/sessions/${sessionId}/warnings`)
      .set('Authorization', `Bearer ${proctorToken}`);
    expect(proctorRes.status).toBe(200);
    expect(proctorRes.body.data).toHaveLength(2);
  });

  it('bypasses warning gate on disqualification / auto-termination', async () => {
    // Ack second warning first so gate is clear
    const [warnRows] = await pool.query<SessionWarningRow[]>(
      'SELECT warning_id FROM Session_Warnings WHERE session_id = ? AND acknowledged_at IS NULL',
      [sessionId]
    );
    const secondWarningId = warnRows[0].warning_id;
    await request(app)
      .post(`/api/sessions/${sessionId}/warnings/${secondWarningId}/ack`)
      .set('Authorization', `Bearer ${studentToken}`);

    // Fast-forward past grace window
    await executeSql(
      'UPDATE Exam_Sessions SET last_warning_ack_at = DATE_SUB(NOW(), INTERVAL 10 SECOND) WHERE id = ?',
      [sessionId]
    );

    clearViolationDebounceCache();

    // Current score is 60. Min trust score is 50.
    // Fire PHONE_DETECTED (25 pts): 60 - 25 = 35 < 50 => TERMINATED_CHEATING
    const termRes = await request(app)
      .post(`/api/sessions/${sessionId}/violation`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        code: 'PHONE_DETECTED',
        evidenceMeta: { phoneDetected: true },
      });

    expect(termRes.status).toBe(201);
    expect(termRes.body.data.status).toBe('TERMINATED_CHEATING');
    expect(termRes.body.data.trust_score).toBe(35);
    expect(termRes.body.data.result).toBeDefined();

    // Verify Exam_Sessions status in DB
    const [sessRows] = await pool.query<RowDataPacket[]>(
      'SELECT status, trust_score FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(sessRows[0].status).toBe('TERMINATED_CHEATING');
    expect(sessRows[0].trust_score).toBe(35);
  });
});
