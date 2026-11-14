-- ============================================================================
-- Test Suite 03: Violation Deduction & Auto-Termination Trigger (trg_after_violation_insert)
-- Tests trust score decay, non-negative clamping, auto-termination, and non-IN_PROGRESS safety.
-- ============================================================================

-- Setup dedicated test session for Student 5 on Exam 2 (min_trust_score = 50, duration = 60)
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (2, 5, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE));

SET @test_sess_id = LAST_INSERT_ID();

-- 1. Initial State: trust_score = 100, status = 'IN_PROGRESS', ended_at IS NULL
SELECT id, trust_score, status, ended_at
  FROM Exam_Sessions
 WHERE id = @test_sess_id;

-- 2. Deduct points: TAB_SWITCH (violation_type_id = 1, penalty = 15) -> trust_score becomes 85
INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (@test_sess_id, 1, JSON_OBJECT('sensor', 'browser_blur'));

SELECT id, trust_score, status, ended_at
  FROM Exam_Sessions
 WHERE id = @test_sess_id;

-- 3. Deduct points: NO_FACE (violation_type_id = 4, penalty = 20) -> trust_score becomes 65
INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (@test_sess_id, 4, JSON_OBJECT('sensor', 'face_lost'));

SELECT id, trust_score, status, ended_at
  FROM Exam_Sessions
 WHERE id = @test_sess_id;

-- 4. Auto-Termination on Breach: DEVTOOLS_OPEN (violation_type_id = 6, penalty = 50)
-- 65 - 50 = 15 (< min_trust_score 50) -> status becomes 'TERMINATED_CHEATING', ended_at IS NOT NULL
INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (@test_sess_id, 6, JSON_OBJECT('sensor', 'debugger_docked'));

SELECT id, trust_score, status, ended_at
  FROM Exam_Sessions
 WHERE id = @test_sess_id;

-- 5. Non-negative Floor Guarantee: another DEVTOOLS_OPEN (-50) on trust = 15 -> clamped to 0, not -35
-- First temporarily set status back to IN_PROGRESS to test floor clamping
UPDATE Exam_Sessions SET status = 'IN_PROGRESS' WHERE id = @test_sess_id;

INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (@test_sess_id, 6, JSON_OBJECT('sensor', 'devtools_again'));

SELECT id, trust_score, status, ended_at
  FROM Exam_Sessions
 WHERE id = @test_sess_id;

-- 6. Non-IN_PROGRESS Session Safety: violations on closed session do nothing
-- Session 13 is SUBMITTED with trust_score = 50
SELECT id, trust_score, status FROM Exam_Sessions WHERE id = 13;

INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta)
VALUES (13, 1, JSON_OBJECT('test', 'late_packet_after_submit'));

-- Trust score and status MUST remain completely unchanged
SELECT id, trust_score, status FROM Exam_Sessions WHERE id = 13;

