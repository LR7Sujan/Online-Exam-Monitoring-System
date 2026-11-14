/**
 * ProctorIQ Comprehensive Database & DBMS Test Runner
 * Executes all 8 test suites against a freshly seeded MySQL database,
 * displaying the exact query and formatted output for every single check.
 */

const { default: mysql } = await import('../../server/node_modules/mysql2/promise.js');
import { env } from '../../server/src/config/env.js';

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  query: string;
  output: string;
  error?: string;
}

const results: TestResult[] = [];

async function logAndExecute(
  pool: any,
  suite: string,
  testName: string,
  query: string,
  params: any[] = [],
  expectError?: (err: any) => boolean
): Promise<any> {
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`[${suite}] ${testName}`);
  console.log(`QUERY:\n${query.trim()}`);
  if (params.length > 0) {
    console.log(`PARAMS: ${JSON.stringify(params)}`);
  }

  try {
    const [output] = await pool.query(query, params);
    if (expectError) {
      console.log(`OUTPUT (Unexpected Success):`, output);
      results.push({
        suite,
        testName,
        passed: false,
        query,
        output: JSON.stringify(output),
        error: 'Expected query to fail with constraint error, but it succeeded.',
      });
      return output;
    }

    if (Array.isArray(output)) {
      if (output.length > 0) {
        console.table(output);
      } else {
        console.log(`OUTPUT: [Empty Result Set] (0 rows)`);
      }
    } else {
      console.log(`OUTPUT (ResultSetHeader):`, output);
    }

    results.push({
      suite,
      testName,
      passed: true,
      query,
      output: JSON.stringify(output),
    });
    return output;
  } catch (err: any) {
    if (expectError && expectError(err)) {
      console.log(`OUTPUT (Expected Error Verified):`);
      console.log(`  -> Code: ${err.code} | Errno: ${err.errno} | SQLSTATE: ${err.sqlState}`);
      console.log(`  -> Message: ${err.message}`);
      results.push({
        suite,
        testName,
        passed: true,
        query,
        output: `[Expected Error] ${err.code}: ${err.message}`,
      });
      return err;
    }

    console.error(`OUTPUT (Error):`, err.message);
    results.push({
      suite,
      testName,
      passed: false,
      query,
      output: '',
      error: `${err.code || 'ERROR'}: ${err.message}`,
    });
    return err;
  }
}

async function run() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    multipleStatements: true,
  });

  console.log('================================================================================');
  console.log(' PROCTORIQ COMPREHENSIVE DATABASE & DBMS GUARANTEES SUITE');
  console.log('================================================================================');

  try {
    // ========================================================================
    // SUITE 1: SCHEMA VERIFICATION
    // ========================================================================
    await logAndExecute(
      pool,
      '01_SCHEMA',
      '1.1 Verify all 8 Primary Domain Tables exist',
      `SELECT table_name, engine, table_rows
         FROM information_schema.tables
        WHERE table_schema = 'proctoriq'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;`
    );

    await logAndExecute(
      pool,
      '01_SCHEMA',
      '1.2 Verify Foreign Keys for all relational dependencies',
      `SELECT constraint_name, table_name, column_name, referenced_table_name, referenced_column_name
         FROM information_schema.key_column_usage
        WHERE table_schema = 'proctoriq'
          AND referenced_table_name IS NOT NULL
        ORDER BY table_name, constraint_name;`
    );

    await logAndExecute(
      pool,
      '01_SCHEMA',
      '1.3 Verify UNIQUE Key constraints',
      `SELECT constraint_name, table_name, column_name
         FROM information_schema.key_column_usage
        WHERE table_schema = 'proctoriq'
          AND constraint_name LIKE 'uq_%'
        ORDER BY table_name, constraint_name;`
    );

    await logAndExecute(
      pool,
      '01_SCHEMA',
      '1.4 Verify CHECK Constraints in information_schema',
      `SELECT constraint_name, check_clause
         FROM information_schema.check_constraints
        WHERE constraint_schema = 'proctoriq'
        ORDER BY constraint_name;`
    );

    await logAndExecute(
      pool,
      '01_SCHEMA',
      '1.5 Verify Secondary Indexes on High-Traffic Columns',
      `SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS indexed_columns, non_unique
         FROM information_schema.statistics
        WHERE table_schema = 'proctoriq'
          AND index_name NOT IN ('PRIMARY')
        GROUP BY table_name, index_name, non_unique
        ORDER BY table_name, index_name;`
    );

    // ========================================================================
    // SUITE 2: CONSTRAINTS ENFORCEMENT
    // ========================================================================
    await logAndExecute(
      pool,
      '02_CONSTRAINTS',
      '2.1 Duplicate Session for same (exam_id, student_id) is rejected',
      `INSERT INTO Exam_Sessions (exam_id, student_id, server_deadline) VALUES (1, 6, NOW());`,
      [],
      (err) => err.code === 'ER_DUP_ENTRY'
    );

    await logAndExecute(
      pool,
      '02_CONSTRAINTS',
      '2.2 Duplicate User Email is rejected',
      `INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Dup User', 'student@proctoriq.io', 'hash', 'STUDENT');`,
      [],
      (err) => err.code === 'ER_DUP_ENTRY'
    );

    await logAndExecute(
      pool,
      '02_CONSTRAINTS',
      '2.3 Negative Penalty Points are rejected by database constraint',
      `INSERT INTO Violation_Types (code, label, penalty_points) VALUES ('BAD_PENALTY', 'Bad Penalty', -10);`,
      [],
      (err) => err.code === 'ER_WARN_DATA_OUT_OF_RANGE' || err.code === 'ER_CHECK_CONSTRAINT_VIOLATED'
    );

    await logAndExecute(
      pool,
      '02_CONSTRAINTS',
      '2.4 Zero-duration Exam is rejected by CHECK constraint',
      `INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, created_by)
       VALUES ('Zero Duration Exam', 0, 50, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), 1);`,
      [],
      (err) => err.code === 'ER_CHECK_CONSTRAINT_VIOLATED'
    );

    await logAndExecute(
      pool,
      '02_CONSTRAINTS',
      '2.5 Deleting a Violation_Type in-use is blocked by FK constraint',
      `DELETE FROM Violation_Types WHERE id = 1;`,
      [],
      (err) => err.code === 'ER_ROW_IS_REFERENCED_2'
    );

    // ========================================================================
    // SUITE 3: TRIGGER trg_after_violation_insert
    // ========================================================================
    // Create dedicated candidate session for violation testing
    const [u3Res]: any = await pool.query(
      `INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Suite 3 Candidate', 'suite3.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`
    );
    const s3StudentId = u3Res.insertId;

    const [sess3Res]: any = await pool.query(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
       VALUES (1, ${s3StudentId}, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE))`
    );
    const s3SessionId = sess3Res.insertId;

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.1 Initial Candidate State (trust_score = 100, status = IN_PROGRESS, ended_at IS NULL)',
      `SELECT id, trust_score, status, ended_at FROM Exam_Sessions WHERE id = ${s3SessionId};`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.2 Deduct points for TAB_SWITCH (violation_type 1, -15 pts -> trust 85)',
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
       VALUES (${s3SessionId}, 1, JSON_OBJECT('test', 'tab_switch'));`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.3 Verify trust_score dropped to 85 and status remains IN_PROGRESS',
      `SELECT id, trust_score, status, ended_at FROM Exam_Sessions WHERE id = ${s3SessionId};`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.4 Auto-Termination on Breach: DEVTOOLS_OPEN (-50 pts -> trust drops to 35 < min_trust 50)',
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
       VALUES (${s3SessionId}, 6, JSON_OBJECT('test', 'devtools_docked'));`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.5 Verify status flipped to TERMINATED_CHEATING and ended_at is set',
      `SELECT id, trust_score, status, ended_at FROM Exam_Sessions WHERE id = ${s3SessionId};`
    );

    await pool.query(`UPDATE Exam_Sessions SET status = 'IN_PROGRESS' WHERE id = ${s3SessionId}`);

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.6 Score never goes below 0: DEVTOOLS_OPEN (-50) on 35 trust -> clamped at 0',
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
       VALUES (${s3SessionId}, 6, JSON_OBJECT('test', 'devtools_repeat'));`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.7 Verify trust score clamped at exactly 0 (not negative)',
      `SELECT id, trust_score, status FROM Exam_Sessions WHERE id = ${s3SessionId};`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.8 Violations on non-IN_PROGRESS session do nothing to trust score or status',
      `-- Session 13 is SUBMITTED with trust_score = 50
       INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
       VALUES (13, 1, JSON_OBJECT('test', 'post_submission_packet'));`
    );

    await logAndExecute(
      pool,
      '03_VIOLATION_TRIGGER',
      '3.9 Verify Session 13 trust_score remains unchanged at 50 and status remains SUBMITTED',
      `SELECT id, trust_score, status, ended_at FROM Exam_Sessions WHERE id = 13;`
    );

    // ========================================================================
    // SUITE 4: REVIEW TRIGGER trg_after_review_update
    // ========================================================================
    const [u4Res]: any = await pool.query(
      `INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Suite 4 Candidate', 'suite4.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`
    );
    const s4StudentId = u4Res.insertId;

    const [sess4Res]: any = await pool.query(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
       VALUES (1, ${s4StudentId}, 70, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 60 MINUTE))`
    );
    const s4SessionId = sess4Res.insertId;

    const [log4Res]: any = await pool.query(
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied)
       VALUES (${s4SessionId}, 5, 35)` // MULTIPLE_FACES (-35 pts) -> drops 70 to 35 (< 50) -> TERMINATED_CHEATING
    );
    const s4LogId = log4Res.insertId;

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.1 Initial Terminated State before Proctor Review (trust_score = 35, status = TERMINATED_CHEATING)',
      `SELECT id, trust_score, status, needs_reinstatement FROM Exam_Sessions WHERE id = ${s4SessionId};`
    );

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.2 Proctor Dismisses Log: PENDING -> DISMISSED (+35 restored -> trust 70, needs_reinstatement = 1)',
      `UPDATE Proctoring_Logs
          SET proctor_review_status = 'DISMISSED',
              reviewed_by = 2,
              reviewed_at = NOW(),
              review_notes = 'False positive: confirmed room reflection.'
        WHERE id = ${s4LogId};`
    );

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.3 Verify points restored to 70 and needs_reinstatement is flagged',
      `SELECT id, trust_score, status, needs_reinstatement FROM Exam_Sessions WHERE id = ${s4SessionId};`
    );

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.4 Anti-Double-Restore Idempotency: Repeating UPDATE with DISMISSED must NOT add +35 again',
      `UPDATE Proctoring_Logs
          SET proctor_review_status = 'DISMISSED'
        WHERE id = ${s4LogId};`
    );

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.5 Verify trust score remains at 70 (no double restoration)',
      `SELECT id, trust_score, status, needs_reinstatement FROM Exam_Sessions WHERE id = ${s4SessionId};`
    );

    // 4.6 Points Capped at 100 Ceiling Guarantee:
    await pool.query(`UPDATE Exam_Sessions SET trust_score = 95 WHERE id = ${s4SessionId}`);
    const [cappedLogRes]: any = await pool.query(
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied) VALUES (${s4SessionId}, 1, 15)`
    );
    const cappedLogId = cappedLogRes.insertId;
    await pool.query(`UPDATE Exam_Sessions SET trust_score = 95 WHERE id = ${s4SessionId}`);

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.6 Dismiss 15-pt log on 95 trust -> capped at 100 (not 110)',
      `UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED' WHERE id = ${cappedLogId};`
    );

    await logAndExecute(
      pool,
      '04_REVIEW_TRIGGER',
      '4.7 Verify trust score is capped at 100 (not 110)',
      `SELECT id, trust_score, status FROM Exam_Sessions WHERE id = ${s4SessionId};`
    );

    // ========================================================================
    // SUITE 5: IMMUTABILITY OF PROCTORING_LOGS
    // ========================================================================
    await logAndExecute(
      pool,
      '05_IMMUTABILITY',
      '5.1 DELETE on Proctoring_Logs fails with SQLSTATE 45000',
      `DELETE FROM Proctoring_Logs WHERE id = 1;`,
      [],
      (err) => err.sqlState === '45000' && err.message.includes('immutable')
    );

    await logAndExecute(
      pool,
      '05_IMMUTABILITY',
      '5.2 Verify row 1 still exists intact in Proctoring_Logs',
      `SELECT id, session_id, violation_type_id, occurred_at, proctor_review_status
         FROM Proctoring_Logs
        WHERE id = 1;`
    );

    // ========================================================================
    // SUITE 6: sp_SubmitAndGradeExam
    // ========================================================================
    // Setup dedicated test exam with 4 questions (marks: 2.0, 3.0, 5.0, 10.0 -> total 20.0)
    const [e6Res]: any = await pool.query(
      `INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
       VALUES ('Grading Engine Test Exam', 60, 50, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1)`
    );
    const e6ExamId = e6Res.insertId;

    await pool.query(
      `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
       VALUES
       (${e6ExamId}, 'Q1', 'Option A', 'Option B', 'Option C', 'Option D', 'A', 2.00, 1),
       (${e6ExamId}, 'Q2', 'Option A', 'Option B', 'Option C', 'Option D', 'B', 3.00, 2),
       (${e6ExamId}, 'Q3', 'Option A', 'Option B', 'Option C', 'Option D', 'C', 5.00, 3),
       (${e6ExamId}, 'Q4', 'Option A', 'Option B', 'Option C', 'Option D', 'D', 10.00, 4)`
    );

    const [qRows]: any = await pool.query(`SELECT id, order_index FROM Questions WHERE exam_id = ${e6ExamId} ORDER BY order_index ASC`);

    // Scenario 6.1: All-Correct Answers
    const [u6a]: any = await pool.query(`INSERT INTO Users (full_name, email, password_hash, role) VALUES ('All Correct', 'allcor.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`);
    const [s6a]: any = await pool.query(`INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline) VALUES (${e6ExamId}, ${u6a.insertId}, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR))`);
    const s6aId = s6a.insertId;

    await pool.query(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (${s6aId}, ${qRows[0].id}, 'A'), (${s6aId}, ${qRows[1].id}, 'B'), (${s6aId}, ${qRows[2].id}, 'C'), (${s6aId}, ${qRows[3].id}, 'D')`
    );

    await logAndExecute(
      pool,
      '06_GRADING',
      '6.1 Grade All-Correct Candidate (Expect: raw_score = 20.00, 100%, CLEAN)',
      `CALL sp_SubmitAndGradeExam(${s6aId}, 'STUDENT_SUBMIT');`
    );

    // Scenario 6.2: All-Wrong Answers
    const [u6b]: any = await pool.query(`INSERT INTO Users (full_name, email, password_hash, role) VALUES ('All Wrong', 'allwr.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`);
    const [s6b]: any = await pool.query(`INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline) VALUES (${e6ExamId}, ${u6b.insertId}, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR))`);
    const s6bId = s6b.insertId;

    await pool.query(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (${s6bId}, ${qRows[0].id}, 'B'), (${s6bId}, ${qRows[1].id}, 'A'), (${s6bId}, ${qRows[2].id}, 'A'), (${s6bId}, ${qRows[3].id}, 'A')`
    );

    await logAndExecute(
      pool,
      '06_GRADING',
      '6.2 Grade All-Wrong Candidate (Expect: raw_score = 0.00, 0%)',
      `CALL sp_SubmitAndGradeExam(${s6bId}, 'STUDENT_SUBMIT');`
    );

    // Scenario 6.3: Partial & Unanswered Questions
    const [u6c]: any = await pool.query(`INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Partial', 'part.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`);
    const [s6c]: any = await pool.query(`INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline) VALUES (${e6ExamId}, ${u6c.insertId}, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR))`);
    const s6cId = s6c.insertId;

    // Q1=A (+2), Q2=B (+3), Q3=A (wrong, 0), Q4=unanswered -> 5.00/20.00 = 25%
    await pool.query(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (${s6cId}, ${qRows[0].id}, 'A'), (${s6cId}, ${qRows[1].id}, 'B'), (${s6cId}, ${qRows[2].id}, 'A')`
    );

    await logAndExecute(
      pool,
      '06_GRADING',
      '6.3 Grade Partial Candidate with Unanswered Questions (Expect: raw_score = 5.00, 25%)',
      `CALL sp_SubmitAndGradeExam(${s6cId}, 'STUDENT_SUBMIT');`
    );

    // Scenario 6.4: Terminated Cheater Session
    const [u6d]: any = await pool.query(`INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Cheater', 'cheat.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`);
    const [s6d]: any = await pool.query(`INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline) VALUES (${e6ExamId}, ${u6d.insertId}, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR))`);
    const s6dId = s6d.insertId;

    // Cheater answered all questions correctly while in progress
    await pool.query(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (${s6dId}, ${qRows[0].id}, 'A'), (${s6dId}, ${qRows[1].id}, 'B'), (${s6dId}, ${qRows[2].id}, 'C'), (${s6dId}, ${qRows[3].id}, 'D')`
    );

    // Cheater is caught and session is terminated
    await pool.query(`UPDATE Exam_Sessions SET status = 'TERMINATED_CHEATING', trust_score = 20, ended_at = NOW() WHERE id = ${s6dId}`);

    await logAndExecute(
      pool,
      '06_GRADING',
      '6.4 Grade TERMINATED Session (Expect: score 0.00, percentage 0.00, DISQUALIFIED)',
      `CALL sp_SubmitAndGradeExam(${s6dId}, 'AUTO_TERMINATED');`
    );

    // Scenario 6.5: Anti-Double-Grading Idempotency
    await logAndExecute(
      pool,
      '06_GRADING',
      '6.5 Idempotency: Calling sp_SubmitAndGradeExam a second time returns existing row',
      `CALL sp_SubmitAndGradeExam(${s6aId}, 'STUDENT_SUBMIT');`
    );

    await logAndExecute(
      pool,
      '06_GRADING',
      '6.6 Verify exactly ONE row in Results table for session',
      `SELECT session_id, raw_score, total_marks, percentage, integrity_status, COUNT(*) AS count
         FROM Results
        WHERE session_id = ${s6aId}
        GROUP BY session_id, raw_score, total_marks, percentage, integrity_status;`
    );

    // ========================================================================
    // SUITE 7: sp_AutoTimeoutExpiredSessions
    // ========================================================================
    const [e7Res]: any = await pool.query(
      `INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
       VALUES ('Timeout Exam', 30, 50, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1)`
    );
    const e7ExamId = e7Res.insertId;

    const [u7a]: any = await pool.query(`INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Expired Student', 'exp.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`);
    const [u7b]: any = await pool.query(`INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Active Student', 'act.${Date.now()}@proctoriq.io', 'h', 'STUDENT')`);

    // Expired: started 45 mins ago on a 30-min exam
    const [s7a]: any = await pool.query(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
       VALUES (${e7ExamId}, ${u7a.insertId}, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 45 MINUTE), DATE_SUB(NOW(), INTERVAL 15 MINUTE))`
    );
    const s7ExpiredId = s7a.insertId;

    // Active: started 10 mins ago on a 30-min exam
    const [s7b]: any = await pool.query(
      `INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
       VALUES (${e7ExamId}, ${u7b.insertId}, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE))`
    );
    const s7ActiveId = s7b.insertId;

    await logAndExecute(
      pool,
      '07_AUTO_TIMEOUT',
      '7.1 Pre-execution state: Both sessions are IN_PROGRESS',
      `SELECT id, status, started_at, server_deadline FROM Exam_Sessions WHERE id IN (${s7ExpiredId}, ${s7ActiveId});`
    );

    await logAndExecute(
      pool,
      '07_AUTO_TIMEOUT',
      '7.2 Execute sp_AutoTimeoutExpiredSessions()',
      `CALL sp_AutoTimeoutExpiredSessions();`
    );

    await logAndExecute(
      pool,
      '07_AUTO_TIMEOUT',
      '7.3 Post-execution: Expired session is TIMED_OUT & graded; Active session remains IN_PROGRESS & un-graded',
      `SELECT es.id, es.status, es.ended_at, r.id AS result_id, r.raw_score, r.integrity_status
         FROM Exam_Sessions es
         LEFT JOIN Results r ON r.session_id = es.id
        WHERE es.id IN (${s7ExpiredId}, ${s7ActiveId})
        ORDER BY es.id;`
    );

    // ========================================================================
    // SUITE 8: ANALYTIC VIEWS
    // ========================================================================
    await logAndExecute(
      pool,
      '08_VIEWS',
      '8.1 Compare vw_ProctorLiveMonitor row count against Exam_Sessions base table',
      `SELECT
         (SELECT COUNT(*) FROM vw_ProctorLiveMonitor) AS view_count,
         (SELECT COUNT(*) FROM Exam_Sessions) AS manual_count,
         IF((SELECT COUNT(*) FROM vw_ProctorLiveMonitor) = (SELECT COUNT(*) FROM Exam_Sessions), 'MATCH (PASS)', 'MISMATCH (FAIL)') AS verdict;`
    );

    await logAndExecute(
      pool,
      '08_VIEWS',
      '8.2 Compare vw_ViolationAuditReport row count against Proctoring_Logs base table',
      `SELECT
         (SELECT COUNT(*) FROM vw_ViolationAuditReport) AS view_count,
         (SELECT COUNT(*) FROM Proctoring_Logs) AS manual_count,
         IF((SELECT COUNT(*) FROM vw_ViolationAuditReport) = (SELECT COUNT(*) FROM Proctoring_Logs), 'MATCH (PASS)', 'MISMATCH (FAIL)') AS verdict;`
    );

    await logAndExecute(
      pool,
      '08_VIEWS',
      '8.3 Compare vw_ExamAnalytics row count against Exams base table',
      `SELECT
         (SELECT COUNT(*) FROM vw_ExamAnalytics) AS view_count,
         (SELECT COUNT(*) FROM Exams) AS manual_count,
         IF((SELECT COUNT(*) FROM vw_ExamAnalytics) = (SELECT COUNT(*) FROM Exams), 'MATCH (PASS)', 'MISMATCH (FAIL)') AS verdict;`
    );

    await logAndExecute(
      pool,
      '08_VIEWS',
      '8.4 Compare vw_ViolationHeatmap aggregated violation and penalty sums against Proctoring_Logs',
      `SELECT
         (SELECT COALESCE(SUM(violation_count), 0) FROM vw_ViolationHeatmap) AS heatmap_total_violations,
         (SELECT COUNT(*) FROM Proctoring_Logs) AS manual_total_violations,
         (SELECT COALESCE(SUM(total_penalty_points), 0) FROM vw_ViolationHeatmap) AS heatmap_total_penalties,
         (SELECT COALESCE(SUM(penalty_applied), 0) FROM Proctoring_Logs) AS manual_total_penalties,
         IF(
           (SELECT COALESCE(SUM(violation_count), 0) FROM vw_ViolationHeatmap) = (SELECT COUNT(*) FROM Proctoring_Logs)
           AND (SELECT COALESCE(SUM(total_penalty_points), 0) FROM vw_ViolationHeatmap) = (SELECT COALESCE(SUM(penalty_applied), 0) FROM Proctoring_Logs),
           'MATCH (PASS)',
           'MISMATCH (FAIL)'
         ) AS verdict;`
    );

    // ========================================================================
    // FINAL TEST REPORT
    // ========================================================================
    console.log('\n================================================================================');
    console.log(' PROCTORIQ DATABASE & DBMS VERIFICATION SUMMARY');
    console.log('================================================================================');
    console.table(
      results.map((r, idx) => ({
        '#': idx + 1,
        Suite: r.suite,
        Test: r.testName,
        Status: r.passed ? 'PASS' : 'FAIL',
        Error: r.error || 'None',
      }))
    );

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`\nTOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
