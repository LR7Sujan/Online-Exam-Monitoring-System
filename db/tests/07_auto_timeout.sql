-- ============================================================================
-- Test Suite 07: Stored Procedure sp_AutoTimeoutExpiredSessions
-- Tests that expired sessions become TIMED_OUT and graded, while active ones remain untouched.
-- ============================================================================

-- Create test exam with duration = 30 minutes
INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
VALUES ('Timeout Test Exam', 30, 50, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1);
SET @timeout_exam_id = LAST_INSERT_ID();

-- 1. Create Expired Candidate Session (started 45 minutes ago on a 30-min exam)
INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Expired Student', 'expired@proctoriq.io', 'h', 'STUDENT');
SET @exp_uid = LAST_INSERT_ID();
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (@timeout_exam_id, @exp_uid, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 45 MINUTE), DATE_SUB(NOW(), INTERVAL 15 MINUTE));
SET @exp_sid = LAST_INSERT_ID();

-- 2. Create Active Candidate Session (started 10 minutes ago on a 30-min exam)
INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Active Student', 'active@proctoriq.io', 'h', 'STUDENT');
SET @act_uid = LAST_INSERT_ID();
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (@timeout_exam_id, @act_uid, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE));
SET @act_sid = LAST_INSERT_ID();

-- Check pre-execution state
SELECT id, status, started_at, server_deadline FROM Exam_Sessions WHERE id IN (@exp_sid, @act_sid);

-- 3. Execute Auto-Timeout Procedure
CALL sp_AutoTimeoutExpiredSessions();

-- 4. Check post-execution state:
-- @exp_sid must become TIMED_OUT and have a row in Results
-- @act_sid must remain IN_PROGRESS and have NO row in Results
SELECT es.id, es.status, es.ended_at, r.id AS result_id, r.raw_score, r.integrity_status
  FROM Exam_Sessions es
  LEFT JOIN Results r ON r.session_id = es.id
 WHERE es.id IN (@exp_sid, @act_sid)
 ORDER BY es.id;

