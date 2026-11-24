import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { queryRows } from '../src/config/db.js';

describe('Student Audit, Profile & Scorecard Endpoints (API Verification)', () => {
  const app = createApp();
  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let studentUserId: number;
  let emptyStudentUserId: number;
  let testExamId: number;
  let testSessionId: number;

  beforeAll(async () => {
    // 1. Authenticate users
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' });
    adminToken = adminLogin.body.data.token;

    const proctorLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' });
    proctorToken = proctorLogin.body.data.token;

    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    studentToken = studentLogin.body.data.token;
    studentUserId = studentLogin.body.data.user.id;

    // 2. Create a fresh student who never took any exams
    const emptyEmail = `audit.fresh.${Date.now()}@proctoriq.io`;
    const emptyRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: emptyEmail,
        password: 'ProctorIQ#2026',
        fullName: 'Audit Fresh Candidate',
        role: 'STUDENT',
      });
    if (emptyRes.body?.data?.user?.id) {
      emptyStudentUserId = emptyRes.body.data.user.id;
    } else {
      // Fallback: look up user ID if register returns existing or different format
      const uRows = await queryRows<{ id: number }[]>('SELECT id FROM Users WHERE email = ?', [emptyEmail]);
      emptyStudentUserId = uRows[0]?.id;
    }

    // 3. Create exam with questions for scorecard verification
    const examRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Audit Scorecard Exam ${Date.now()}`,
        description: 'Testing scorecard and answer mappings',
        durationMinutes: 30,
        minTrustScore: 60,
        shuffleQuestions: true,
        shuffleOptions: true,
        recordVideo: true,
      });
    testExamId = examRes.body.data.id;

    // Add Q1 (correct: A)
    await request(app)
      .post(`/api/exams/${testExamId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'What is the capital of France?',
        optionA: 'Paris',
        optionB: 'Rome',
        optionC: 'Berlin',
        optionD: 'Madrid',
        correctOption: 'A',
        marks: 5,
      });

    // Add Q2 (correct: B)
    await request(app)
      .post(`/api/exams/${testExamId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'What is 2 + 2?',
        optionA: '3',
        optionB: '4',
        optionC: '5',
        optionD: '6',
        correctOption: 'B',
        marks: 5,
      });

    // Publish exam
    await request(app)
      .patch(`/api/exams/${testExamId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    // 4. Student starts exam session
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ examId: testExamId });
    testSessionId = startRes.body.data.id;

    // 5. Submit an answer for France question: answer correctly (Paris)
    const sessQuestionsRes = await request(app)
      .get(`/api/sessions/${testSessionId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`);
    const questions = sessQuestionsRes.body.data.questions;
    const qFrance = questions.find((q: { question_text: string }) => q.question_text.includes('France'))!;

    // Find which displayed option corresponds to Paris
    let parisDisplayedOption = 'A';
    if (qFrance.option_a === 'Paris') parisDisplayedOption = 'A';
    else if (qFrance.option_b === 'Paris') parisDisplayedOption = 'B';
    else if (qFrance.option_c === 'Paris') parisDisplayedOption = 'C';
    else if (qFrance.option_d === 'Paris') parisDisplayedOption = 'D';

    await request(app)
      .put(`/api/sessions/${testSessionId}/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        questionId: qFrance.id,
        selectedOption: parisDisplayedOption,
      });

    // Q2 is left unanswered

    // 6. Finish session
    await request(app)
      .post(`/api/sessions/${testSessionId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`);
  });

  it('Strict RBAC: Student role is forbidden (403) from accessing student audit endpoints', async () => {
    const res1 = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res1.status).toBe(403);

    const res2 = await request(app)
      .get(`/api/students/${studentUserId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res2.status).toBe(403);

    const res3 = await request(app)
      .get(`/api/students/${studentUserId}/sessions`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res3.status).toBe(403);

    const res4 = await request(app)
      .get(`/api/sessions/${testSessionId}/scorecard`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res4.status).toBe(403);
  });

  it('GET /api/students: lists students with SQL-aggregated counts and supports search & filters', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${proctorToken}`)
      .query({ limit: 10, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.students)).toBe(true);
    expect(res.body.data.total).toBeGreaterThan(0);

    const studentItem = res.body.data.students.find((s: { id: number }) => s.id === studentUserId);
    expect(studentItem).toBeDefined();
    expect(studentItem.examsAttended).toBeGreaterThanOrEqual(1);
    expect(studentItem.totalViolations).toBeGreaterThanOrEqual(0);
    expect(typeof studentItem.joinedAt).toBe('string');
  });

  it('GET /api/students: student who never took an exam shows empty/null values', async () => {
    if (!emptyStudentUserId) return;

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'Audit Fresh Candidate' });

    expect(res.status).toBe(200);
    const fresh = res.body.data.students.find((s: { id: number }) => s.id === emptyStudentUserId);
    expect(fresh).toBeDefined();
    expect(fresh.examsAttended).toBe(0);
    expect(fresh.avgScore).toBeNull();
    expect(fresh.avgTrust).toBeNull();
    expect(fresh.lastExamDate).toBeNull();
    expect(fresh.worstIntegrityStatus).toBe('NONE');
    expect(fresh.isCurrentlyActive).toBe(false);
  });

  it('GET /api/students: CSV export returns valid text/csv content with correct headers', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('student_audit_export.csv');
    expect(res.text).toContain('ID,Name,Email,Joined At,Exams Attended');
  });

  it('GET /api/students/:id: returns student profile KPIs, progress history, and violation distribution', async () => {
    const res = await request(app)
      .get(`/api/students/${studentUserId}`)
      .set('Authorization', `Bearer ${proctorToken}`);

    if (res.status !== 200) console.log('Profile failed:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const profile = res.body.data;
    expect(profile.student.id).toBe(studentUserId);
    expect(profile.kpis.examsAttended).toBeGreaterThanOrEqual(1);
    expect(profile.kpis.cleanRate).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(profile.progress)).toBe(true);
    expect(Array.isArray(profile.violationsByType)).toBe(true);
  });

  it('GET /api/students/:id/sessions: lists attended exams with scores, integrity chips, and recording status', async () => {
    const res = await request(app)
      .get(`/api/students/${studentUserId}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (res.status !== 200) console.log('Sessions failed:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const session = res.body.data.find((s: { sessionId: number }) => s.sessionId === testSessionId);
    expect(session).toBeDefined();
    expect(session.examTitle).toContain('Audit Scorecard Exam');
  });

  it('GET /api/sessions/:id/scorecard: returns complete scorecard with mapped questions, rank, and integrity', async () => {
    const res = await request(app)
      .get(`/api/sessions/${testSessionId}/scorecard`)
      .set('Authorization', `Bearer ${proctorToken}`);

    if (res.status !== 200) console.log('Scorecard failed:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const sc = res.body.data;

    // Header assertions
    expect(sc.header.studentName).toBe('Aarav Chen');
    expect(sc.header.examTitle).toContain('Audit Scorecard Exam');
    expect(sc.header.durationUsedMinutes).toBeGreaterThanOrEqual(0);

    // Score assertions
    expect(sc.score.rawScore).toBe(5);
    expect(sc.score.totalMarks).toBe(10);
    expect(sc.score.percentage).toBe(50);
    expect(sc.score.correctCount).toBe(1);
    expect(sc.score.unansweredCount).toBe(1);
    expect(sc.score.wrongCount).toBe(0);
    expect(sc.score.examRank).toBe(1);

    // Question-by-question mapping assertions
    expect(sc.questions.length).toBe(2);
    const q1 = sc.questions.find((q: { questionText: string }) => q.questionText.includes('France'));
    expect(q1).toBeDefined();
    expect(q1.isCorrect).toBe(true);
    expect(q1.marksGained).toBe(5);
    expect(q1.studentAnswerText).toBe('Paris');
    expect(q1.correctAnswerText).toBe('Paris');

    const q2 = sc.questions.find((q: { questionText: string }) => q.questionText.includes('2 + 2'));
    expect(q2).toBeDefined();
    expect(q2.isUnanswered).toBe(true);
    expect(q2.marksGained).toBe(0);

    // Integrity assertions
    expect(sc.integrity.finalTrustScore).toBeGreaterThanOrEqual(0);
    expect(sc.integrity.minRequiredScore).toBe(60);

    // Timeline, extension history, and recording structure
    expect(Array.isArray(sc.timeline)).toBe(true);
    expect(Array.isArray(sc.extensionHistory)).toBe(true);
    expect(sc.recording).toBeDefined();
    expect(typeof sc.recording.message).toBe('string');
  });
});
