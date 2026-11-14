-- ============================================================================
-- Test Suite 06: Transactional Grading Engine (sp_SubmitAndGradeExam)
-- Tests all-correct, all-wrong, unanswered, terminated session (score 0, DISQUALIFIED),
-- and idempotency (calling it twice yields exactly one Results row).
-- ============================================================================

-- Create dedicated test exam with 4 questions (marks: 2.0, 3.0, 5.0, 10.0 -> Total = 20.00)
INSERT INTO Exams (title, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
VALUES ('Grading Engine Test Exam', 60, 50, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1, 1);
SET @test_exam_id = LAST_INSERT_ID();

INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
VALUES
  (@test_exam_id, 'Q1', 'Option A', 'Option B', 'Option C', 'Option D', 'A', 2.00, 1),
  (@test_exam_id, 'Q2', 'Option A', 'Option B', 'Option C', 'Option D', 'B', 3.00, 2),
  (@test_exam_id, 'Q3', 'Option A', 'Option B', 'Option C', 'Option D', 'C', 5.00, 3),
  (@test_exam_id, 'Q4', 'Option A', 'Option B', 'Option C', 'Option D', 'D', 10.00, 4);

-- SCENARIO 1: All-Correct Answers (Expect: raw_score = 20.00, percentage = 100.00%, integrity = 'CLEAN')
INSERT INTO Users (full_name, email, password_hash, role) VALUES ('All Correct', 'all.correct@proctoriq.io', 'h', 'STUDENT');
SET @s1_uid = LAST_INSERT_ID();
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
VALUES (@test_exam_id, @s1_uid, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR));
SET @s1_id = LAST_INSERT_ID();

INSERT INTO Student_Responses (session_id, question_id, selected_option)
SELECT @s1_id, id, correct_option FROM Questions WHERE exam_id = @test_exam_id;

CALL sp_SubmitAndGradeExam(@s1_id, 'STUDENT_SUBMIT');

-- SCENARIO 2: All-Wrong Answers (Expect: raw_score = 0.00, percentage = 0.00%)
INSERT INTO Users (full_name, email, password_hash, role) VALUES ('All Wrong', 'all.wrong@proctoriq.io', 'h', 'STUDENT');
SET @s2_uid = LAST_INSERT_ID();
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
VALUES (@test_exam_id, @s2_uid, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR));
SET @s2_id = LAST_INSERT_ID();

-- Answer wrong option for all questions
INSERT INTO Student_Responses (session_id, question_id, selected_option)
SELECT @s2_id, id, IF(correct_option = 'A', 'B', 'A') FROM Questions WHERE exam_id = @test_exam_id;

CALL sp_SubmitAndGradeExam(@s2_id, 'STUDENT_SUBMIT');

-- SCENARIO 3: Partial & Unanswered Questions (Answer Q1=A (+2), Q2=B (+3), Q3=wrong, Q4=unanswered -> Expect: 5.00/20.00 = 25.00%)
INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Partial Candidate', 'partial@proctoriq.io', 'h', 'STUDENT');
SET @s3_uid = LAST_INSERT_ID();
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
VALUES (@test_exam_id, @s3_uid, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR));
SET @s3_id = LAST_INSERT_ID();

SET @q1_id = (SELECT id FROM Questions WHERE exam_id = @test_exam_id AND order_index = 1);
SET @q2_id = (SELECT id FROM Questions WHERE exam_id = @test_exam_id AND order_index = 2);
SET @q3_id = (SELECT id FROM Questions WHERE exam_id = @test_exam_id AND order_index = 3);

INSERT INTO Student_Responses (session_id, question_id, selected_option)
VALUES (@s3_id, @q1_id, 'A'), (@s3_id, @q2_id, 'B'), (@s3_id, @q3_id, 'A');

CALL sp_SubmitAndGradeExam(@s3_id, 'STUDENT_SUBMIT');

-- SCENARIO 4: Terminated Cheater Session (Expect: score = 0.00, percentage = 0.00, integrity_status = 'DISQUALIFIED')
INSERT INTO Users (full_name, email, password_hash, role) VALUES ('Terminated Candidate', 'cheater@proctoriq.io', 'h', 'STUDENT');
SET @s4_uid = LAST_INSERT_ID();
INSERT INTO Exam_Sessions (exam_id, student_id, trust_score, status, server_deadline)
VALUES (@test_exam_id, @s4_uid, 100, 'IN_PROGRESS', DATE_ADD(NOW(), INTERVAL 1 HOUR));
SET @s4_id = LAST_INSERT_ID();

-- Cheater entered answers while in progress:
INSERT INTO Student_Responses (session_id, question_id, selected_option)
SELECT @s4_id, id, correct_option FROM Questions WHERE exam_id = @test_exam_id;

-- Cheater caught and terminated:
UPDATE Exam_Sessions SET status = 'TERMINATED_CHEATING', trust_score = 30, ended_at = NOW() WHERE id = @s4_id;

CALL sp_SubmitAndGradeExam(@s4_id, 'AUTO_TERMINATED');

-- SCENARIO 5: Anti-Double-Grading Idempotency Guarantee
-- Calling sp_SubmitAndGradeExam a second time on @s1_id must return existing row and NOT insert another row
CALL sp_SubmitAndGradeExam(@s1_id, 'STUDENT_SUBMIT');

-- Verify exactly ONE Results row exists for @s1_id
SELECT COUNT(*) AS results_row_count FROM Results WHERE session_id = @s1_id;
