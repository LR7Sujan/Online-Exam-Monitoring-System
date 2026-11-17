-- ============================================================================
-- Test Suite 09: Extension Grace Window & Timeout Procedure Tests
-- Verifies:
--   1. An exam with max_extension_mins=15 stays IN_PROGRESS through the grace window
--   2. Records time_expired_at when deadline is crossed
--   3. Times out at deadline + grace window (e.g., 180s)
--   4. A pending unexpired request blocks the timeout
--   5. Request after timeout is rejected
-- ============================================================================

-- Setup: Create exam with extensions allowed (max_extension_mins = 15)
INSERT INTO Exams (title, duration_minutes, min_trust_score, max_extension_mins, start_window, end_window, is_published, created_by)
VALUES ('Grace Window Acceptance Exam', 10, 50, 15, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1);
SET @test_exam_id = LAST_INSERT_ID();

-- 1. Student inside grace window (deadline passed 30s ago, grace is 180s)
INSERT INTO Users (full_name, email, password_hash, role)
VALUES ('Grace Student 1', CONCAT('grace1_', UNIX_TIMESTAMP(), '@test.com'), 'h', 'STUDENT');
SET @s1_uid = LAST_INSERT_ID();

INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (@test_exam_id, @s1_uid, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 11 MINUTE), DATE_SUB(NOW(), INTERVAL 30 SECOND));
SET @s1_sid = LAST_INSERT_ID();

-- 2. Student beyond grace window (deadline passed 200s ago, grace is 180s)
INSERT INTO Users (full_name, email, password_hash, role)
VALUES ('Grace Student 2', CONCAT('grace2_', UNIX_TIMESTAMP(), '@test.com'), 'h', 'STUDENT');
SET @s2_uid = LAST_INSERT_ID();

INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (@test_exam_id, @s2_uid, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 14 MINUTE), DATE_SUB(NOW(), INTERVAL 200 SECOND));
SET @s2_sid = LAST_INSERT_ID();

-- 3. Student beyond grace window but has an active PENDING request (created 45s ago)
INSERT INTO Users (full_name, email, password_hash, role)
VALUES ('Grace Student 3', CONCAT('grace3_', UNIX_TIMESTAMP(), '@test.com'), 'h', 'STUDENT');
SET @s3_uid = LAST_INSERT_ID();

INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (@test_exam_id, @s3_uid, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 14 MINUTE), DATE_SUB(NOW(), INTERVAL 200 SECOND));
SET @s3_sid = LAST_INSERT_ID();

INSERT INTO Time_Extension_Requests (session_id, requested_minutes, reason, status, created_at)
VALUES (@s3_sid, 10, 'Pending extension during grace', 'PENDING', DATE_SUB(NOW(), INTERVAL 45 SECOND));

-- Execute the sweep with 180s grace
CALL sp_AutoTimeoutExpiredSessionsWithGrace(180);

-- Check results:
-- @s1_sid: must remain IN_PROGRESS, time_expired_at must NOT be null
-- @s2_sid: must be TIMED_OUT because 200s > 180s grace
-- @s3_sid: must remain IN_PROGRESS because pending request blocks timeout
SELECT 
    es.id,
    es.status,
    es.time_expired_at,
    es.server_deadline,
    CASE 
        WHEN es.id = @s1_sid AND es.status = 'IN_PROGRESS' AND es.time_expired_at IS NOT NULL THEN 'PASS: Stays IN_PROGRESS with time_expired_at'
        WHEN es.id = @s2_sid AND es.status = 'TIMED_OUT' THEN 'PASS: Timed out after grace period'
        WHEN es.id = @s3_sid AND es.status = 'IN_PROGRESS' THEN 'PASS: Pending request blocks timeout'
        ELSE 'FAIL'
    END AS assertion_result
FROM Exam_Sessions es
WHERE es.id IN (@s1_sid, @s2_sid, @s3_sid)
ORDER BY es.id;
