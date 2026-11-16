-- ============================================================================
-- ProctorIQ Find Test Data (Read-Only Dry Run Audit)
-- Database: proctoriq
-- Identifies candidate test records created during automated/agent testing.
-- ============================================================================

USE proctoriq;

-- 1. Candidate Test Exams (Certain vs Unsure)
SELECT 
  'EXAM' AS entity_type,
  e.id,
  e.title AS identifier,
  e.created_at,
  (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.id) AS dependent_questions,
  (SELECT COUNT(*) FROM Exam_Sessions s WHERE s.exam_id = e.id) AS dependent_sessions,
  (SELECT COUNT(*) FROM Student_Responses sr JOIN Exam_Sessions s ON sr.session_id = s.id WHERE s.exam_id = e.id) AS dependent_responses,
  (SELECT COUNT(*) FROM Proctoring_Logs pl JOIN Exam_Sessions s ON pl.session_id = s.id WHERE s.exam_id = e.id) AS dependent_logs,
  (SELECT COUNT(*) FROM Results r JOIN Exam_Sessions s ON r.session_id = s.id WHERE s.exam_id = e.id) AS dependent_results,
  (SELECT COUNT(*) FROM Time_Extension_Requests ter JOIN Exam_Sessions s ON ter.session_id = s.id WHERE s.exam_id = e.id) AS dependent_extensions,
  CASE 
    WHEN e.id BETWEEN 1 AND 5 THEN 'REAL_SEED_EXAM (DO NOT DELETE)'
    WHEN e.title LIKE 'Lifecycle Exam%' 
      OR e.title LIKE 'Timeout Exam%' 
      OR e.title LIKE 'Grading Engine Test%' 
      OR e.title LIKE 'Test Exam%' 
      OR e.title LIKE 'API Test Exam%'
      OR e.title REGEXP '1794[0-9]{9,}' THEN 'CERTAIN_TEST'
    ELSE 'UNSURE'
  END AS confidence_classification
FROM Exams e
ORDER BY e.id;

-- 2. Candidate Test Users (Certain vs Seed)
SELECT 
  'USER' AS entity_type,
  u.id,
  u.email AS identifier,
  u.full_name,
  u.role,
  u.created_at,
  (SELECT COUNT(*) FROM Exam_Sessions s WHERE s.student_id = u.id) AS dependent_sessions,
  (SELECT COUNT(*) FROM Time_Extension_Requests ter JOIN Exam_Sessions s ON ter.session_id = s.id WHERE s.student_id = u.id) AS dependent_extensions,
  CASE 
    WHEN u.id BETWEEN 1 AND 64 AND u.email NOT LIKE '%.1794%' AND u.email NOT LIKE '%test%' THEN 'REAL_SEED_USER (DO NOT DELETE)'
    WHEN u.email LIKE 'virtual.candidate.%'
      OR u.email LIKE 'debounce.%'
      OR u.email LIKE 'autoterm.%'
      OR u.email LIKE 'rt1.%' OR u.email LIKE 'rt2.%' OR u.email LIKE 'rt3.%'
      OR u.email LIKE 'offlineSync.%'
      OR u.email LIKE 'candidate.%'
      OR u.email LIKE 'security.student.%'
      OR u.email LIKE 'approve-test.%'
      OR u.email LIKE 'reject-test.%'
      OR u.email LIKE '%@proctoriq.test'
      OR u.email LIKE '%@example.test'
      OR u.email REGEXP '1794[0-9]{9,}' THEN 'CERTAIN_TEST'
    ELSE 'UNSURE'
  END AS confidence_classification
FROM Users u
WHERE u.id > 64 
   OR u.email LIKE '%test%' 
   OR u.email REGEXP '1794[0-9]{9,}'
ORDER BY u.id;

-- 3. Total Table Sizes and Row Counts in `proctoriq`
SELECT 
  table_name,
  table_rows AS estimated_row_count,
  ROUND(((data_length + index_length) / 1024), 2) AS total_size_kb,
  ROUND((data_length / 1024), 2) AS data_size_kb,
  ROUND((index_length / 1024), 2) AS index_size_kb
FROM information_schema.tables
WHERE table_schema = 'proctoriq'
ORDER BY (data_length + index_length) DESC;
