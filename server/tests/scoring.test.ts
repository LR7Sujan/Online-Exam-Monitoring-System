import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, pool, queryRows } from '../src/config/db.js';

describe('Scoring Logic & Integrity Status Engine', () => {
  let examId: number;
  let studentId: number;
  let sessionId: number;

  beforeAll(async () => {
    // Create dedicated test exam with known questions and marks
    const examRes = await executeSql(
      `INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
       VALUES ('Vitest Scoring Specification Exam', 60, 60, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1)`
    );
    examId = examRes.insertId;

    // Insert 4 questions (marks: 2.0, 3.0, 5.0, 10.0 -> total marks = 20.0)
    await executeSql(
      `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
       VALUES
       (?, 'What is the ACID guarantee for Durability?', 'Write to WAL', 'Keep in RAM', 'Drop locks', 'Rollback', 'A', 2.0, 1),
       (?, 'Which isolation level prevents non-repeatable reads?', 'Read Committed', 'Repeatable Read', 'Read Uncommitted', 'None', 'B', 3.0, 2),
       (?, 'What consensus algorithm is used by etcd?', 'Paxos', 'Raft', 'Two-Phase Commit', 'Gossip', 'B', 5.0, 3),
       (?, 'What lock type is acquired by SELECT ... FOR UPDATE?', 'Shared S-lock', 'Exclusive X-lock', 'Intent Shared', 'Table Lock', 'B', 10.0, 4)`,
      [examId, examId, examId, examId]
    );

    // Create test student
    const studentRes = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES ('Scoring Candidate', 'scoring.candidate.${Date.now()}@proctoriq.io', 'hash', 'STUDENT', 1)`
    );
    studentId = studentRes.insertId;
  });

  afterAll(async () => {
    if (examId) {
      await executeSql('DELETE FROM Exams WHERE id = ?', [examId]);
    }
    if (studentId) {
      await executeSql('DELETE FROM Users WHERE id = ?', [studentId]);
    }
  });

  it('correctly calculates raw score, total marks, and percentage via stored procedure', async () => {
    // Start session
    const sessRes = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline, paper_code, paper_hash)
       VALUES (?, ?, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'Paper SC01', SHA2(UUID(), 256))`,
      [examId, studentId]
    );
    sessionId = sessRes.insertId;

    // Fetch questions to answer
    const questions = await queryRows<RowDataPacket[]>(
      'SELECT id, correct_option, marks FROM Questions WHERE exam_id = ? ORDER BY order_index ASC',
      [examId]
    );
    expect(questions.length).toBe(4);

    // Answer Q1 correctly ('A' -> +2 marks)
    // Answer Q2 correctly ('B' -> +3 marks)
    // Answer Q3 incorrectly ('A' != 'B' -> +0 marks)
    // Leave Q4 unanswered -> +0 marks
    // Expected raw score = 5.00 / 20.00 = 25.00%
    await executeSql(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (?, ?, 'A'), (?, ?, 'B'), (?, ?, 'A')`,
      [sessionId, questions[0].id, sessionId, questions[1].id, sessionId, questions[2].id]
    );

    // Grade exam via stored procedure
    const [resultSets] = await pool.query<RowDataPacket[][]>(
      'CALL sp_SubmitAndGradeExam(?, ?)',
      [sessionId, 'STUDENT_SUBMIT']
    );
    const result = resultSets[0]?.[0];

    expect(result).toBeDefined();
    expect(Number(result.raw_score)).toBe(5.00);
    expect(Number(result.total_marks)).toBe(20.00);
    expect(Number(result.percentage)).toBe(25.00);
    expect(result.session_status).toBe('SUBMITTED');
  });

  it('assigns CLEAN integrity status when trust score remains 100', async () => {
    const rows = await queryRows<RowDataPacket[]>(
      'SELECT integrity_status, final_trust_score FROM Results WHERE session_id = ?',
      [sessionId]
    );
    expect(rows[0].final_trust_score).toBe(100);
    expect(rows[0].integrity_status).toBe('CLEAN');
  });

  it('assigns FLAGGED integrity status when trust score is below 100 but >= min_trust_score', async () => {
    // Create a new candidate session with 80 trust score
    const uRes = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES ('Flagged Candidate', 'flagged.candidate.${Date.now()}@proctoriq.io', 'hash', 'STUDENT', 1)`
    );
    const flaggedStudentId = uRes.insertId;

    const sRes = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline, paper_code, paper_hash)
       VALUES (?, ?, 80, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'Paper SC02', SHA2(UUID(), 256))`,
      [examId, flaggedStudentId]
    );
    const fSessionId = sRes.insertId;

    const [resultSets] = await pool.query<RowDataPacket[][]>(
      'CALL sp_SubmitAndGradeExam(?, ?)',
      [fSessionId, 'STUDENT_SUBMIT']
    );
    const result = resultSets[0]?.[0];

    expect(result.final_trust_score).toBe(80);
    expect(result.integrity_status).toBe('FLAGGED');

    await executeSql('DELETE FROM Users WHERE id = ?', [flaggedStudentId]);
  });

  it('assigns DISQUALIFIED integrity status when trust score < min_trust_score or terminated', async () => {
    const uRes = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES ('Cheater Candidate', 'cheater.candidate.${Date.now()}@proctoriq.io', 'hash', 'STUDENT', 1)`
    );
    const cheaterStudentId = uRes.insertId;

    const sRes = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline, paper_code, paper_hash)
       VALUES (?, ?, 40, 'TERMINATED_CHEATING', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'Paper SC03', SHA2(UUID(), 256))`,
      [examId, cheaterStudentId]
    );
    const cSessionId = sRes.insertId;

    const [resultSets] = await pool.query<RowDataPacket[][]>(
      'CALL sp_SubmitAndGradeExam(?, ?)',
      [cSessionId, 'AUTO_TERMINATED']
    );
    const result = resultSets[0]?.[0];

    expect(result.final_trust_score).toBe(40);
    expect(result.integrity_status).toBe('DISQUALIFIED');
    expect(result.session_status).toBe('TERMINATED_CHEATING');

    await executeSql('DELETE FROM Users WHERE id = ?', [cheaterStudentId]);
  });
});

