import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, pool, queryRows } from '../src/config/db.js';

describe('MySQL Database Guarantees: Triggers, Concurrency & Immutability', () => {
  let examId: number;
  let studentId: number;
  let sessionId: number;

  beforeAll(async () => {
    // Setup test exam with min_trust_score = 60
    const examRes = await executeSql(
      `INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
       VALUES ('SQL Guarantees Verification Exam', 60, 60, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1)`
    );
    examId = examRes.insertId;

    // Create student
    const stuRes = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES ('Guarantees Student', 'guarantees.${Date.now()}@proctoriq.io', 'hash', 'STUDENT', 1)`
    );
    studentId = stuRes.insertId;

    // Start session
    const sessRes = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
       VALUES (?, ?, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [examId, studentId]
    );
    sessionId = sessRes.insertId;
  });

  afterAll(async () => {
    if (examId) await executeSql('DELETE FROM Exams WHERE id = ?', [examId]);
    if (studentId) await executeSql('DELETE FROM Users WHERE id = ?', [studentId]);
  });

  // Guarantee 1: Violation Trigger & Auto-Termination
  it('GUARANTEE 1: trg_after_violation_insert deducts penalty and auto-terminates when threshold is breached', async () => {
    // 1. Initial trust score is 100
    const initialRows = await queryRows<RowDataPacket[]>(
      'SELECT trust_score, status, ended_at FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(initialRows[0].trust_score).toBe(100);
    expect(initialRows[0].status).toBe('IN_PROGRESS');
    expect(initialRows[0].ended_at).toBeNull();

    // 2. Insert TAB_SWITCH (-15 pts) -> trust score should become 85
    const ins1 = await executeSql(
      'INSERT INTO Proctoring_Logs (session_id, violation_type_id) VALUES (?, 1)',
      [sessionId]
    );
    expect(ins1.insertId).toBeGreaterThan(0);

    const step1Rows = await queryRows<RowDataPacket[]>(
      'SELECT trust_score, status FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(step1Rows[0].trust_score).toBe(85);
    expect(step1Rows[0].status).toBe('IN_PROGRESS');

    // 3. Insert MULTIPLE_FACES (-35 pts) -> trust score becomes 50 (< min_trust_score 60)
    // trg_after_violation_insert must atomically flip status to TERMINATED_CHEATING and set ended_at
    await executeSql(
      'INSERT INTO Proctoring_Logs (session_id, violation_type_id) VALUES (?, 5)',
      [sessionId]
    );

    const step2Rows = await queryRows<RowDataPacket[]>(
      'SELECT trust_score, status, ended_at FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(step2Rows[0].trust_score).toBe(50);
    expect(step2Rows[0].status).toBe('TERMINATED_CHEATING');
    expect(step2Rows[0].ended_at).not.toBeNull();
  });

  // Guarantee 2: Review-Restore Trigger & Reinstatement Flag
  it('GUARANTEE 2: trg_after_review_update restores points upon DISMISSED and flags needs_reinstatement', async () => {
    // Check recent MULTIPLE_FACES log (violation_type_id = 5, penalty = 35)
    const logs = await queryRows<RowDataPacket[]>(
      `SELECT id, penalty_applied, proctor_review_status
         FROM Proctoring_Logs
        WHERE session_id = ? AND violation_type_id = 5
        ORDER BY id DESC LIMIT 1`,
      [sessionId]
    );
    expect(logs.length).toBe(1);
    const logId = logs[0].id;
    expect(logs[0].proctor_review_status).toBe('PENDING');

    // Proctor dismisses the violation -> status becomes DISMISSED
    // trg_after_review_update should restore +35 pts (from 50 -> 85), which is >= min_trust_score (60),
    // and flag needs_reinstatement = 1 without silently un-terminating the exam
    await executeSql(
      `UPDATE Proctoring_Logs
          SET proctor_review_status = 'DISMISSED',
              reviewed_by = 1,
              reviewed_at = NOW(),
              review_notes = 'False positive: room reflection verified.'
        WHERE id = ?`,
      [logId]
    );

    const restoredRows = await queryRows<RowDataPacket[]>(
      'SELECT trust_score, status, needs_reinstatement FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(restoredRows[0].trust_score).toBe(85);
    expect(restoredRows[0].needs_reinstatement).toBe(1);

    // If proctor changes status back to CONFIRMED, penalty must be re-applied
    await executeSql(
      `UPDATE Proctoring_Logs
          SET proctor_review_status = 'CONFIRMED',
              review_notes = 'Re-evaluated: second face confirmed.'
        WHERE id = ?`,
      [logId]
    );

    const reAppliedRows = await queryRows<RowDataPacket[]>(
      'SELECT trust_score FROM Exam_Sessions WHERE id = ?',
      [sessionId]
    );
    expect(reAppliedRows[0].trust_score).toBe(50);
  });

  // Guarantee 3: Concurrent No-Double-Grading Guarantee (SELECT ... FOR UPDATE)
  it('GUARANTEE 3: sp_SubmitAndGradeExam concurrency with SELECT ... FOR UPDATE produces exactly ONE Results row', async () => {
    // Create new fresh candidate for concurrent test
    const uRes = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES ('Concurrent Candidate', 'concurrent.${Date.now()}@proctoriq.io', 'hash', 'STUDENT', 1)`
    );
    const cStudentId = uRes.insertId;

    const sRes = await executeSql(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
       VALUES (?, ?, 95, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [examId, cStudentId]
    );
    const concurrentSessionId = sRes.insertId;

    // Simulate 5 simultaneous concurrent submit requests (e.g. candidate clicks Submit while timeout trigger fires)
    const promises = [
      pool.query<RowDataPacket[][]>('CALL sp_SubmitAndGradeExam(?, ?)', [concurrentSessionId, 'STUDENT_SUBMIT']),
      pool.query<RowDataPacket[][]>('CALL sp_SubmitAndGradeExam(?, ?)', [concurrentSessionId, 'AUTO_TIMEOUT']),
      pool.query<RowDataPacket[][]>('CALL sp_SubmitAndGradeExam(?, ?)', [concurrentSessionId, 'PROCTOR_FORCE']),
      pool.query<RowDataPacket[][]>('CALL sp_SubmitAndGradeExam(?, ?)', [concurrentSessionId, 'STUDENT_SUBMIT']),
      pool.query<RowDataPacket[][]>('CALL sp_SubmitAndGradeExam(?, ?)', [concurrentSessionId, 'AUTO_TERMINATED']),
    ];

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(5); // All 5 succeed gracefully without deadlocks or unhandled exceptions

    // Inspect Results table: there must be exactly ONE row for concurrentSessionId
    const resultRows = await queryRows<RowDataPacket[]>(
      'SELECT id, session_id, raw_score, final_trust_score, integrity_status FROM Results WHERE session_id = ?',
      [concurrentSessionId]
    );
    expect(resultRows.length).toBe(1);

    // Verify session ended_at is recorded
    const finalSession = await queryRows<RowDataPacket[]>(
      'SELECT status, ended_at FROM Exam_Sessions WHERE id = ?',
      [concurrentSessionId]
    );
    expect(finalSession[0].ended_at).not.toBeNull();

    await executeSql('DELETE FROM Users WHERE id = ?', [cStudentId]);
  });
});

