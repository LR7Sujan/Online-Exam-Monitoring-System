-- ============================================================================
-- Test Suite 04: Proctor Review Trigger (trg_after_review_update)
-- Tests score restoration, 100-point ceiling, and anti-double-restoration idempotency.
-- ============================================================================

-- Create test session with trust_score = 70
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, started_at, server_deadline)
VALUES (2, 5, 70, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE));

SET @review_sess_id = LAST_INSERT_ID();

-- Insert MULTIPLE_FACES (-35 pts) -> drops to 35 (< min_trust_score 50), auto-terminates
INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied, evidence_meta)
VALUES (@review_sess_id, 5, 35, JSON_OBJECT('faces', 2));

SET @multi_face_log_id = LAST_INSERT_ID();

-- Check terminated state
SELECT id, trust_score, status, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @review_sess_id;

-- 1. Proctor Dismisses Violation: PENDING -> DISMISSED
-- Restores +35 pts (35 -> 70), flags needs_reinstatement = TRUE without silently reopening status
UPDATE Proctoring_Logs
   SET proctor_review_status = 'DISMISSED',
       reviewed_by = 2,
       reviewed_at = NOW(),
       review_notes = 'False positive: poster in background.'
 WHERE id = @multi_face_log_id;

SELECT id, trust_score, status, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @review_sess_id;

-- 2. Anti-Double-Restore Idempotency: Repeating UPDATE with DISMISSED must NOT add +35 again!
UPDATE Proctoring_Logs
   SET proctor_review_status = 'DISMISSED'
 WHERE id = @multi_face_log_id;

SELECT id, trust_score, status, needs_reinstatement
  FROM Exam_Sessions
 WHERE id = @review_sess_id;

-- 3. Capped at 100 Ceiling Guarantee:
-- Set trust to 90, insert TAB_SWITCH (penalty 15 -> trust 75), then dismiss it (75 + 15 = 90)
-- Now set trust to 95 and dismiss a 15-pt log -> must cap at 100, not 110!
UPDATE Exam_Sessions SET trust_score = 95 WHERE id = @review_sess_id;

INSERT INTO Proctoring_Logs (session_id, violation_type_id, penalty_applied)
VALUES (@review_sess_id, 1, 15);
SET @cap_log_id = LAST_INSERT_ID();

-- Session is now at 80 (95 - 15)
-- Now manually simulate session starting at 95, dismiss 15-pt log: 95 + 15 = 110 -> capped at 100!
UPDATE Exam_Sessions SET trust_score = 95 WHERE id = @review_sess_id;

UPDATE Proctoring_Logs
   SET proctor_review_status = 'DISMISSED',
       reviewed_by = 2,
       reviewed_at = NOW(),
       review_notes = 'Cap check'
 WHERE id = @cap_log_id;

SELECT id, trust_score, status
  FROM Exam_Sessions
 WHERE id = @review_sess_id;
