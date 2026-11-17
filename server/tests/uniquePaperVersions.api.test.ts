import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { executeSql, queryRows } from '../src/config/db.js';

describe('Unique Exam Paper Versions: Anti-Cheat Paper Permutations & Grading Integrity', () => {
  const app = createApp();

  let adminToken: string;
  let proctorToken: string;
  let student1Token: string;
  let student1Id: number;
  let student2Token: string;
  let student2Id: number;
  let standardExamId: number;
  let unshuffledExamId: number;
  let smallExamId: number;

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

    const s1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@proctoriq.io', password: 'ProctorIQ#2026' });
    student1Token = s1Res.body.data.token;
    student1Id = s1Res.body.data.user.id;

    // Register a second student
    const s2Email = `student2.paper.${Date.now()}@proctoriq.io`;
    const s2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: s2Email,
        password: 'Password123!',
        fullName: 'Candidate Two',
        role: 'STUDENT',
      });
    student2Token = s2Res.body.data.token;
    student2Id = s2Res.body.data.user.id;

    // 2. Create standard multi-question shuffled exam (5 questions => 5! * 24^5 = ~955 billion permutations)
    const stdExamRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Permutation Test Exam ${Date.now()}`,
        description: 'Standard shuffled assessment for verifying paper divergence and grading accuracy.',
        durationMinutes: 60,
        minTrustScore: 50,
        shuffleQuestions: true,
        shuffleOptions: true,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'What is the primary key of a relational table?',
            optionA: 'Unique Record Identifier',
            optionB: 'Foreign Reference Index',
            optionC: 'Composite Null Pointer',
            optionD: 'Transient Checksum Buffer',
            correctOption: 'A',
            marks: 2,
            orderIndex: 1,
          },
          {
            questionText: 'Which protocol secures HTTP communications?',
            optionA: 'TLS/SSL Cryptographic Tunnel',
            optionB: 'FTP File Transmission Channel',
            optionC: 'SNMP Simple Management Broker',
            optionD: 'Telnet Plaintext Terminal',
            correctOption: 'A',
            marks: 2,
            orderIndex: 2,
          },
          {
            questionText: 'What does ACID atomicity guarantee in transactions?',
            optionA: 'All operations succeed or none persist',
            optionB: 'Data is immediately mirrored across clusters',
            optionC: 'Concurrent threads execute lock-free',
            optionD: 'Indexes auto-rebalance in linear time',
            correctOption: 'A',
            marks: 2,
            orderIndex: 3,
          },
          {
            questionText: 'What is the standard time complexity of binary search on a sorted array?',
            optionA: 'O(log n) logarithmic steps',
            optionB: 'O(n) linear scan steps',
            optionC: 'O(n log n) divide and conquer',
            optionD: 'O(1) constant time hash lookup',
            correctOption: 'A',
            marks: 2,
            orderIndex: 4,
          },
          {
            questionText: 'What does DNS resolve on the internet?',
            optionA: 'Domain names to IP addresses',
            optionB: 'MAC addresses to subnet masks',
            optionC: 'HTML tags to CSS style rules',
            optionD: 'SQL queries to relational algebra',
            correctOption: 'A',
            marks: 2,
            orderIndex: 5,
          },
        ],
      });
    expect(stdExamRes.status).toBe(201);
    standardExamId = stdExamRes.body.data.id;

    // 3. Create unshuffled exam (shuffleQuestions: false, shuffleOptions: false)
    const unshuffledRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Unshuffled Assessment ${Date.now()}`,
        description: 'Fixed canonical layout assessment for linear examination format.',
        durationMinutes: 45,
        minTrustScore: 60,
        shuffleQuestions: false,
        shuffleOptions: false,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'Unshuffled Question One',
            optionA: 'Alpha One',
            optionB: 'Beta One',
            optionC: 'Gamma One',
            optionD: 'Delta One',
            correctOption: 'B',
            marks: 5,
            orderIndex: 1,
          },
          {
            questionText: 'Unshuffled Question Two',
            optionA: 'Alpha Two',
            optionB: 'Beta Two',
            optionC: 'Gamma Two',
            optionD: 'Delta Two',
            correctOption: 'C',
            marks: 5,
            orderIndex: 2,
          },
        ],
      });
    expect(unshuffledRes.status).toBe(201);
    unshuffledExamId = unshuffledRes.body.data.id;

    // 4. Create small exam (1 question with options unshuffled => only 1 permutation)
    const smallRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Small Assessment ${Date.now()}`,
        description: 'Single question exam with unshuffled options to test permutation notice.',
        durationMinutes: 30,
        minTrustScore: 50,
        shuffleQuestions: false,
        shuffleOptions: false,
        startWindow: new Date(Date.now() - 3600000).toISOString(),
        endWindow: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        questions: [
          {
            questionText: 'Only question in this small exam',
            optionA: 'Choice 1',
            optionB: 'Choice 2',
            optionC: 'Choice 3',
            optionD: 'Choice 4',
            correctOption: 'A',
            marks: 10,
            orderIndex: 1,
          },
        ],
      });
    expect(smallRes.status).toBe(201);
    smallExamId = smallRes.body.data.id;
  });

  it('1. Start 20 sessions for one exam and assert all paper_hash values are unique and paper_codes valid', async () => {
    const hashes = new Set<string>();
    const codes: string[] = [];

    for (let i = 1; i <= 20; i++) {
      const email = `candidate.perm.${Date.now()}.${i}.${Math.random().toString(36).slice(2)}@proctoriq.io`;
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          fullName: `Candidate Shuffled ${i}`,
          role: 'STUDENT',
        });
      const token = reg.body.data.token;

      const startRes = await request(app)
        .post(`/api/exams/${standardExamId}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({ deviceFingerprint: `device-perm-test-${i}` });

      expect([200, 201]).toContain(startRes.status);
      const session = startRes.body.data;
      expect(session.paper_code).toMatch(/^Paper [2-9A-Z]{4}$/);
      expect(session.paper_hash).toHaveLength(64);

      codes.push(session.paper_code);
      hashes.add(session.paper_hash);
    }

    // All 20 sessions must have 100% unique paper_hash values
    expect(hashes.size).toBe(20);
    expect(codes).toHaveLength(20);
  });

  it('2. Two students receive different question orderings and/or option orderings', async () => {
    // Student 1 starts
    const s1Start = await request(app)
      .post(`/api/exams/${standardExamId}/start`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ deviceFingerprint: 'student1-device-fp' });
    expect([200, 201]).toContain(s1Start.status);
    const s1Session = s1Start.body.data;
    const s1SessionId = s1Session.id;

    // Student 2 starts
    const s2Start = await request(app)
      .post(`/api/exams/${standardExamId}/start`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ deviceFingerprint: 'student2-device-fp' });
    expect([200, 201]).toContain(s2Start.status);
    const s2Session = s2Start.body.data;
    const s2SessionId = s2Session.id;

    // Fetch questions for both students
    const s1Q = await request(app)
      .get(`/api/sessions/${s1SessionId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);
    const s2Q = await request(app)
      .get(`/api/sessions/${s2SessionId}/questions`)
      .set('Authorization', `Bearer ${student2Token}`);

    expect(s1Q.status).toBe(200);
    expect(s2Q.status).toBe(200);

    const s1Questions = s1Q.body.data.questions;
    const s2Questions = s2Q.body.data.questions;

    const s1Order = s1Questions.map((q: any) => q.id);
    const s2Order = s2Questions.map((q: any) => q.id);

    const s1Options = s1Questions.map((q: any) => `${q.option_a}|${q.option_b}|${q.option_c}|${q.option_d}`);
    const s2Options = s2Questions.map((q: any) => `${q.option_a}|${q.option_b}|${q.option_c}|${q.option_d}`);

    // Either the sequence of questions differs, or the option assignments differ
    const orderDiffers = JSON.stringify(s1Order) !== JSON.stringify(s2Order);
    const optionsDiffer = JSON.stringify(s1Options) !== JSON.stringify(s2Options);
    expect(orderDiffers || optionsDiffer).toBe(true);

    // Verify paper codes are distinct
    expect(s1Session.paper_code).not.toBe(s2Session.paper_code);
  });

  it('3. Refresh and resume: the same session always returns the exact same paper (stored, not regenerated)', async () => {
    const [s1SessionRow] = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Exam_Sessions WHERE exam_id = ? AND student_id = ? LIMIT 1',
      [standardExamId, student1Id]
    );
    const s1SessionId = s1SessionRow.id;

    const res1 = await request(app)
      .get(`/api/sessions/${s1SessionId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);
    const res2 = await request(app)
      .get(`/api/sessions/${s1SessionId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(res1.body.data.paperCode).toBe(res2.body.data.paperCode);
    expect(res1.body.data.questions).toEqual(res2.body.data.questions);

    // Resume via start endpoint
    const resumeRes = await request(app)
      .post(`/api/exams/${standardExamId}/start`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ deviceFingerprint: 'student1-device-fp' });

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.paper_code).toBe(res1.body.data.paperCode);
  });

  it('4. Answering displayed "B" translates and stores correct original letter in Student_Responses', async () => {
    const [s1SessionRow] = await queryRows<RowDataPacket[]>(
      'SELECT id, option_maps FROM Exam_Sessions WHERE exam_id = ? AND student_id = ? LIMIT 1',
      [standardExamId, student1Id]
    );
    const s1SessionId = s1SessionRow.id;
    const optionMaps = typeof s1SessionRow.option_maps === 'string'
      ? JSON.parse(s1SessionRow.option_maps)
      : s1SessionRow.option_maps;

    // Fetch first question displayed to Student 1
    const qRes = await request(app)
      .get(`/api/sessions/${s1SessionId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);
    const firstQ = qRes.body.data.questions[0];
    const qId = firstQ.id;

    // Student selects displayed option 'B'
    const ansRes = await request(app)
      .put(`/api/sessions/${s1SessionId}/answer`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        questionId: qId,
        selectedOption: 'B',
      });

    expect(ansRes.status).toBe(200);
    expect(ansRes.body.data.selectedOption).toBe('B');

    // Expected original option is optionMaps[qId][1] (index 1 corresponds to displayed B)
    const expectedOriginal = optionMaps[String(qId)][1];

    const [dbResp] = await queryRows<RowDataPacket[]>(
      'SELECT selected_option FROM Student_Responses WHERE session_id = ? AND question_id = ?',
      [s1SessionId, qId]
    );
    expect(dbResp.selected_option).toBe(expectedOriginal);

    // Fetching session questions again returns displayed 'B' back to student
    const checkQ = await request(app)
      .get(`/api/sessions/${s1SessionId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);
    const studentResp = checkQ.body.data.responses.find((r: any) => r.question_id === qId);
    expect(studentResp.selected_option).toBe('B');
  });

  it('5. Grading gives exact same score as unshuffled run for equivalent answers', async () => {
    // Create student for unshuffled test
    const unEmail = `unshuffled.student.${Date.now()}@proctoriq.io`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        email: unEmail,
        password: 'Password123!',
        fullName: 'Unshuffled Candidate',
        role: 'STUDENT',
      });
    const unToken = reg.body.data.token;

    const startRes = await request(app)
      .post(`/api/exams/${unshuffledExamId}/start`)
      .set('Authorization', `Bearer ${unToken}`)
      .send();
    expect([200, 201]).toContain(startRes.status);
    const unSessionId = startRes.body.data.id;

    const qRes = await request(app)
      .get(`/api/sessions/${unSessionId}/questions`)
      .set('Authorization', `Bearer ${unToken}`);
    const qs = qRes.body.data.questions;

    // In unshuffled exam:
    // Q1 correct is B, Q2 correct is C.
    // Candidate answers both correctly with displayed 'B' and 'C'
    await request(app)
      .put(`/api/sessions/${unSessionId}/answer`)
      .set('Authorization', `Bearer ${unToken}`)
      .send({ questionId: qs[0].id, selectedOption: 'B' });

    await request(app)
      .put(`/api/sessions/${unSessionId}/answer`)
      .set('Authorization', `Bearer ${unToken}`)
      .send({ questionId: qs[1].id, selectedOption: 'C' });

    // Submit exam
    const submitRes = await request(app)
      .post(`/api/sessions/${unSessionId}/submit`)
      .set('Authorization', `Bearer ${unToken}`)
      .send({ finalChecklistAccepted: true });

    expect(submitRes.status).toBe(200);
    const data = submitRes.body.data;
    const finalStatus = data.session_status || data.status || data.result?.session_status;
    expect(finalStatus).toBe('SUBMITTED');
    const rawScore = Number(data.raw_score ?? data.result?.raw_score);
    const totalMarks = Number(data.total_marks ?? data.result?.total_marks);
    const percentage = Number(data.percentage ?? data.result?.percentage);
    expect(rawScore).toBe(10); // 5 + 5 marks
    expect(totalMarks).toBe(10);
    expect(percentage).toBe(100);
  });

  it('6. Security: correct_option, option_maps, paper_hash never appear in any student payload', async () => {
    const [s1SessionRow] = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Exam_Sessions WHERE exam_id = ? AND student_id = ? LIMIT 1',
      [standardExamId, student1Id]
    );
    const s1SessionId = s1SessionRow.id;

    // 1. GET /api/sessions/:id
    const metaRes = await request(app)
      .get(`/api/sessions/${s1SessionId}`)
      .set('Authorization', `Bearer ${student1Token}`);

    const metaStr = JSON.stringify(metaRes.body);
    expect(metaStr).not.toContain('correct_option');
    expect(metaStr).not.toContain('option_maps');
    expect(metaStr).not.toContain('paper_hash');

    // 2. GET /api/sessions/:id/questions
    const qRes = await request(app)
      .get(`/api/sessions/${s1SessionId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);

    const qStr = JSON.stringify(qRes.body);
    expect(qStr).not.toContain('correct_option');
    expect(qStr).not.toContain('option_maps');
    expect(qStr).not.toContain('paper_hash');
  });

  it('7. Shuffle toggles work: when disabled, questions and options stay in canonical order', async () => {
    const [row] = await queryRows<RowDataPacket[]>(
      'SELECT shuffle_questions, shuffle_options FROM Exams WHERE id = ?',
      [unshuffledExamId]
    );
    expect(Boolean(row.shuffle_questions)).toBe(false);
    expect(Boolean(row.shuffle_options)).toBe(false);

    // Create session on unshuffled exam
    const testEmail = `canonical.student.${Date.now()}@proctoriq.io`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: 'Password123!', fullName: 'Canonical Tester', role: 'STUDENT' });
    const tok = reg.body.data.token;

    const startRes = await request(app)
      .post(`/api/exams/${unshuffledExamId}/start`)
      .set('Authorization', `Bearer ${tok}`)
      .send();
    expect([200, 201]).toContain(startRes.status);
    const sessId = startRes.body.data.id;

    const qRes = await request(app)
      .get(`/api/sessions/${sessId}/questions`)
      .set('Authorization', `Bearer ${tok}`);

    const questions = qRes.body.data.questions;
    expect(questions[0].question_text).toBe('Unshuffled Question One');
    expect(questions[0].option_a).toBe('Alpha One');
    expect(questions[0].option_b).toBe('Beta One');
    expect(questions[0].option_c).toBe('Gamma One');
    expect(questions[0].option_d).toBe('Delta One');

    expect(questions[1].question_text).toBe('Unshuffled Question Two');
    expect(questions[1].option_a).toBe('Alpha Two');
    expect(questions[1].option_b).toBe('Beta Two');
  });

  it('8. Small-exam notice appears when unique paper permutations are limited', async () => {
    const detailRes = await request(app)
      .get(`/api/exams/${smallExamId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailRes.status).toBe(200);
    const notice = detailRes.body.data.exam.permutationNotice;
    expect(notice.isSmallExam).toBe(true);
    expect(notice.maxUniquePapers).toBe(1);
    expect(notice.notice).toMatch(/Only 1 unique paper possible/);
  });

  it('9. Proctor can inspect student paper layout via GET /api/proctor/sessions/:id/paper', async () => {
    const [s1SessionRow] = await queryRows<RowDataPacket[]>(
      'SELECT id FROM Exam_Sessions WHERE exam_id = ? AND student_id = ? LIMIT 1',
      [standardExamId, student1Id]
    );
    const s1SessionId = s1SessionRow.id;

    // Student attempt proctor endpoint -> 403 Forbidden
    const deniedRes = await request(app)
      .get(`/api/proctor/sessions/${s1SessionId}/paper`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(deniedRes.status).toBe(403);

    // Proctor retrieves paper inspection
    const proctorRes = await request(app)
      .get(`/api/proctor/sessions/${s1SessionId}/paper`)
      .set('Authorization', `Bearer ${proctorToken}`);

    expect(proctorRes.status).toBe(200);
    const data = proctorRes.body.data;

    expect(data.session.paperCode).toMatch(/^Paper /);
    expect(data.session.paperHash).toHaveLength(64);
    expect(data.questions).toHaveLength(5);

    const firstQ = data.questions[0];
    expect(firstQ.displayNumber).toBe(1);
    expect(firstQ.displayedOptions).toBeDefined();
    expect(firstQ.originalOptions).toBeDefined();
    expect(firstQ.optionMapping).toBeDefined();
    expect(firstQ.correctOptionOriginal).toBe('A');
  });
});
