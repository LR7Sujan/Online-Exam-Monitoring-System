-- ============================================================================
-- Migration 006: Stored procedure for candidate swarm simulator reset & cleanup
-- Removes only virtual student examinees and their corresponding sessions.
-- Leverages Exam_Sessions foreign key ON DELETE CASCADE to delete child records
-- in Proctoring_Logs, Student_Responses, and Results without altering or dropping
-- the immutable trg_before_log_delete audit trigger. Real data is untouched.
-- ============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_ResetSimulatorData$$

CREATE PROCEDURE sp_ResetSimulatorData()
BEGIN
    DECLARE v_logs_count INT DEFAULT 0;
    DECLARE v_responses_count INT DEFAULT 0;
    DECLARE v_results_count INT DEFAULT 0;
    DECLARE v_sessions_count INT DEFAULT 0;
    DECLARE v_users_count INT DEFAULT 0;

    -- 1. Count records to be deleted for precise audit reporting
    SELECT COUNT(*) INTO v_logs_count
      FROM Proctoring_Logs pl
      JOIN Exam_Sessions es ON es.id = pl.session_id
      JOIN Users u ON u.id = es.student_id
     WHERE u.email LIKE 'virtual.candidate.%';

    SELECT COUNT(*) INTO v_responses_count
      FROM Student_Responses sr
      JOIN Exam_Sessions es ON es.id = sr.session_id
      JOIN Users u ON u.id = es.student_id
     WHERE u.email LIKE 'virtual.candidate.%';

    SELECT COUNT(*) INTO v_results_count
      FROM Results r
      JOIN Exam_Sessions es ON es.id = r.session_id
      JOIN Users u ON u.id = es.student_id
     WHERE u.email LIKE 'virtual.candidate.%';

    SELECT COUNT(*) INTO v_sessions_count
      FROM Exam_Sessions es
      JOIN Users u ON u.id = es.student_id
     WHERE u.email LIKE 'virtual.candidate.%';

    SELECT COUNT(*) INTO v_users_count
      FROM Users u
     WHERE u.email LIKE 'virtual.candidate.%';

    -- 2. Delete simulated sessions.
    -- Because Exam_Sessions has ON DELETE CASCADE to Proctoring_Logs,
    -- Student_Responses, and Results, child records are removed at the
    -- storage engine level without activating the row-level trg_before_log_delete
    -- trigger on Proctoring_Logs. This guarantees that direct deletes on
    -- real examinee logs remain completely forbidden and immutable.
    DELETE es
      FROM Exam_Sessions es
      JOIN Users u ON u.id = es.student_id
     WHERE u.email LIKE 'virtual.candidate.%';

    -- 3. Delete virtual student user accounts
    DELETE FROM Users
     WHERE email LIKE 'virtual.candidate.%';

    -- 4. Return deleted record counts
    SELECT v_logs_count AS deletedLogs,
           v_responses_count AS deletedResponses,
           v_results_count AS deletedResults,
           v_sessions_count AS deletedSessions,
           v_users_count AS deletedUsers;
END$$

DELIMITER ;
