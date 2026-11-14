-- ============================================================================
-- Test Suite 02: Constraint Enforcement
-- Tests duplicate rejection, range check constraints, and FK delete restrictions.
-- ============================================================================

-- 1. Attempt Duplicate Session for Same (exam_id, student_id) -> Expected: ER_DUP_ENTRY (1062)
-- Exam 1, Student 6 already has Session 1
INSERT INTO Exam_Sessions (exam_id, student_id, server_deadline)
VALUES (1, 6, NOW());

-- 2. Attempt Duplicate User Email -> Expected: ER_DUP_ENTRY (1062)
-- 'student@proctoriq.io' already exists
INSERT INTO Users (full_name, email, password_hash, role)
VALUES ('Duplicate Candidate', 'student@proctoriq.io', 'hash123', 'STUDENT');

-- 3. Attempt Negative / Invalid Penalty Points -> Expected: ER_WARN_DATA_OUT_OF_RANGE or ER_CHECK_CONSTRAINT_VIOLATED
INSERT INTO Violation_Types (code, label, penalty_points)
VALUES ('TEST_NEGATIVE_PENALTY', 'Negative Penalty Violation', -10);

-- 4. Attempt Zero-Duration Exam -> Expected: ER_CHECK_CONSTRAINT_VIOLATED (3819)
INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, created_by)
VALUES ('Zero Duration Exam', 0, 50, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), 1);

-- 5. Attempt to Delete a Violation_Type In-Use -> Expected: ER_ROW_IS_REFERENCED_2 (1451)
-- Violation_Type 1 (TAB_SWITCH) is referenced in Proctoring_Logs
DELETE FROM Violation_Types WHERE id = 1;

