-- ============================================================================
-- ProctorIQ Acceptance & DBMS Verification Script
-- ============================================================================
USE proctoriq;

-- 1. Verify seeded counts
SELECT 'Users_By_Role' AS check_name, role, COUNT(*) AS total FROM Users GROUP BY role;
SELECT 'Exams_Total' AS check_name, COUNT(*) AS exams_count FROM Exams;
SELECT 'Questions_Total' AS check_name, COUNT(*) AS questions_count FROM Questions;
SELECT 'Sessions_By_Status' AS check_name, status, COUNT(*) AS total FROM Exam_Sessions GROUP BY status;
SELECT 'Proctoring_Logs_Total' AS check_name, COUNT(*) AS logs_count FROM Proctoring_Logs;
SELECT 'Results_By_Integrity' AS check_name, integrity_status, COUNT(*) AS total FROM Results GROUP BY integrity_status;

-- 2. Acceptance Test: Insert Proctoring_Logs -> lowers trust_score -> crosses threshold -> TERMINATED_CHEATING
-- Student id=5 (student@proctoriq.io) has not started live Exam id=1 (min_trust_score = 50)
CALL sp_StartExamSession(1, 5);
SET @test_sid = (SELECT id FROM Exam_Sessions WHERE exam_id = 1 AND student_id = 5 LIMIT 1);

SELECT id, trust_score, status, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @test_sid;

-- Violation 1: TAB_SWITCH (id=1, penalty=15) -> trust_score drops 100 -> 85 (IN_PROGRESS)
INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (@test_sid, 1, JSON_OBJECT('test', 'step1_tab_switch'));

SELECT id, trust_score, status, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @test_sid;

-- Violation 2: DEVTOOLS_OPEN (id=6, penalty=50) -> trust_score drops 85 -> 35 (< 50) -> TERMINATED_CHEATING
INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (@test_sid, 6, JSON_OBJECT('test', 'step2_devtools_open'));

SELECT id, trust_score, status, ended_at, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @test_sid;

-- 3. Acceptance Test: Dismiss DEVTOOLS_OPEN log (PENDING -> DISMISSED) -> restores +50 (35 -> 85 >= 50)
--    Sets needs_reinstatement = TRUE without silently reopening status!
SET @devtools_log_id = (
  SELECT id FROM Proctoring_Logs
   WHERE session_id = @test_sid AND violation_type_id = 6
   ORDER BY id DESC LIMIT 1
);

UPDATE Proctoring_Logs
   SET proctor_review_status = 'DISMISSED',
       reviewed_by = 2,
       reviewed_at = NOW(),
       review_notes = 'False positive verified on screen recording'
 WHERE id = @devtools_log_id;

SELECT id, trust_score, status, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @test_sid;

-- 4. Test sp_AutoTimeoutExpiredSessions on expired IN_PROGRESS session #12
CALL sp_AutoTimeoutExpiredSessions();
SELECT id, status, ended_at FROM Exam_Sessions WHERE id = 12;
SELECT session_id, raw_score, total_marks, percentage, integrity_status FROM Results WHERE session_id = 12;

-- 5. Verify Analytics & Heatmap Views
SELECT exam_id, exam_title, total_sessions, avg_percentage, pass_rate_pct, total_violations
  FROM vw_ExamAnalytics;

SELECT hour_of_day, violation_code, violation_count, total_penalty_points
  FROM vw_ViolationHeatmap
 LIMIT 15;

