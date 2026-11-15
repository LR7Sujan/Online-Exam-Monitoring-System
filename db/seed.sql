-- ============================================================================
-- ProctorIQ Seed Data
-- 1 Admin, 3 Proctors, 60 Students, 4 Exams (20 Qs each = 80),
-- 40 Sessions, 300 Proctoring_Logs across past 30 days, and Results.
-- Demo password for ALL seeded accounts: ProctorIQ#2026
-- ============================================================================

USE proctoriq;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Results;
TRUNCATE TABLE Proctoring_Logs;
TRUNCATE TABLE Student_Responses;
TRUNCATE TABLE Exam_Sessions;
TRUNCATE TABLE Questions;
TRUNCATE TABLE Exams;
TRUNCATE TABLE Users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1 Admin, 3 Proctors, 60 Students
INSERT INTO Users (id, full_name, email, password_hash, role, is_active) VALUES
(1, 'Dr. Elena Vance', 'admin@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'ADMIN', TRUE),
(2, 'Marcus Sterling', 'proctor@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'PROCTOR', TRUE),
(3, 'Priya Nair', 'proctor2@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'PROCTOR', TRUE),
(4, 'Julian Mercer', 'proctor3@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'PROCTOR', TRUE),
(5, 'Aarav Chen', 'student@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(6, 'Sophia O''Connor', 'student2@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(7, 'Liam Patel', 'student3@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(8, 'Maya Alvarez', 'student4@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(9, 'Noah Brooks', 'student5@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(10, 'Zara Singh', 'student6@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(11, 'Ethan Wright', 'student7@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(12, 'Aria Sharma', 'student8@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(13, 'Lucas Vance', 'student9@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(14, 'Nadia Rivera', 'student10@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(15, 'Kabir Das', 'student11@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(16, 'Elena Kaur', 'student12@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(17, 'Owen Park', 'student13@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(18, 'Chloe Rao', 'student14@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(19, 'Rohan Foster', 'student15@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(20, 'Isha Chen', 'student16@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(21, 'Mateo O''Connor', 'student17@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(22, 'Hannah Patel', 'student18@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(23, 'Leo Alvarez', 'student19@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(24, 'Ananya Brooks', 'student20@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(25, 'Aarav Singh', 'student21@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(26, 'Sophia Wright', 'student22@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(27, 'Liam Sharma', 'student23@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(28, 'Maya Vance', 'student24@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(29, 'Noah Rivera', 'student25@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(30, 'Zara Das', 'student26@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(31, 'Ethan Kaur', 'student27@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(32, 'Aria Park', 'student28@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(33, 'Lucas Rao', 'student29@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(34, 'Nadia Foster', 'student30@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(35, 'Kabir Chen', 'student31@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(36, 'Elena O''Connor', 'student32@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(37, 'Owen Patel', 'student33@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(38, 'Chloe Alvarez', 'student34@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(39, 'Rohan Brooks', 'student35@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(40, 'Isha Singh', 'student36@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(41, 'Mateo Wright', 'student37@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(42, 'Hannah Sharma', 'student38@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(43, 'Leo Vance', 'student39@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(44, 'Ananya Rivera', 'student40@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(45, 'Aarav Das', 'student41@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(46, 'Sophia Kaur', 'student42@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(47, 'Liam Park', 'student43@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(48, 'Maya Rao', 'student44@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(49, 'Noah Foster', 'student45@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(50, 'Zara Chen', 'student46@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(51, 'Ethan O''Connor', 'student47@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(52, 'Aria Patel', 'student48@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(53, 'Lucas Alvarez', 'student49@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(54, 'Nadia Brooks', 'student50@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(55, 'Kabir Singh', 'student51@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(56, 'Elena Wright', 'student52@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(57, 'Owen Sharma', 'student53@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(58, 'Chloe Vance', 'student54@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(59, 'Rohan Rivera', 'student55@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(60, 'Isha Das', 'student56@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(61, 'Mateo Kaur', 'student57@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(62, 'Hannah Park', 'student58@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(63, 'Leo Rao', 'student59@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(64, 'Ananya Foster', 'student60@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE);

-- 4 Exams (1 live now, 1 upcoming, 2 finished)
INSERT INTO Exams (id, title, description, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by) VALUES
  (1, 'CS-401: Distributed Database Systems & ACID Internals', 'Live assessment covering InnoDB MVCC, SELECT ... FOR UPDATE locking, triggers, and Raft consensus.', 60, 50, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 6 HOUR), TRUE, 1),
  (2, 'SEC-305: Applied Cryptography & Zero-Trust Architecture', 'Upcoming exam on authenticated encryption, JWT verification, key rotation, and threat modeling.', 45, 60, DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), TRUE, 1),
  (3, 'SYS-310: Operating Systems & Concurrency Control', 'Completed exam covering virtual memory, page faults, semaphores, and deadlock prevention.', 60, 50, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), TRUE, 1),
  (4, 'NET-220: Computer Networks & Transport Protocols', 'Completed exam evaluating TCP congestion control, TLS 1.3 handshakes, and BGP routing.', 50, 55, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), TRUE, 1);

-- 80 Questions (20 per exam)
INSERT INTO Questions (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index) VALUES
(1, 1, 'Exam 1 Q1: Which statement accurately characterizes MVCC snapshot isolation under strict consistency guarantees?', 'Primary invariant for MVCC snapshot isolation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 1),
(2, 1, 'Exam 1 Q2: Which statement accurately characterizes two-phase locking under strict consistency guarantees?', 'Primary invariant for two-phase locking using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 2),
(3, 1, 'Exam 1 Q3: Which statement accurately characterizes B+Tree secondary indexing under strict consistency guarantees?', 'Primary invariant for B+Tree secondary indexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 3),
(4, 1, 'Exam 1 Q4: Which statement accurately characterizes write-ahead redo logging under strict consistency guarantees?', 'Primary invariant for write-ahead redo logging using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 4),
(5, 1, 'Exam 1 Q5: Which statement accurately characterizes InnoDB buffer pool flushing under strict consistency guarantees?', 'Primary invariant for InnoDB buffer pool flushing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 5),
(6, 1, 'Exam 1 Q6: Which statement accurately characterizes MVCC snapshot isolation under strict consistency guarantees?', 'Primary invariant for MVCC snapshot isolation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 6),
(7, 1, 'Exam 1 Q7: Which statement accurately characterizes two-phase locking under strict consistency guarantees?', 'Primary invariant for two-phase locking using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 7),
(8, 1, 'Exam 1 Q8: Which statement accurately characterizes B+Tree secondary indexing under strict consistency guarantees?', 'Primary invariant for B+Tree secondary indexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 8),
(9, 1, 'Exam 1 Q9: Which statement accurately characterizes write-ahead redo logging under strict consistency guarantees?', 'Primary invariant for write-ahead redo logging using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 9),
(10, 1, 'Exam 1 Q10: Which statement accurately characterizes InnoDB buffer pool flushing under strict consistency guarantees?', 'Primary invariant for InnoDB buffer pool flushing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 10),
(11, 1, 'Exam 1 Q11: Which statement accurately characterizes MVCC snapshot isolation under strict consistency guarantees?', 'Primary invariant for MVCC snapshot isolation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 11),
(12, 1, 'Exam 1 Q12: Which statement accurately characterizes two-phase locking under strict consistency guarantees?', 'Primary invariant for two-phase locking using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 12),
(13, 1, 'Exam 1 Q13: Which statement accurately characterizes B+Tree secondary indexing under strict consistency guarantees?', 'Primary invariant for B+Tree secondary indexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 13),
(14, 1, 'Exam 1 Q14: Which statement accurately characterizes write-ahead redo logging under strict consistency guarantees?', 'Primary invariant for write-ahead redo logging using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 14),
(15, 1, 'Exam 1 Q15: Which statement accurately characterizes InnoDB buffer pool flushing under strict consistency guarantees?', 'Primary invariant for InnoDB buffer pool flushing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 15),
(16, 1, 'Exam 1 Q16: Which statement accurately characterizes MVCC snapshot isolation under strict consistency guarantees?', 'Primary invariant for MVCC snapshot isolation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 16),
(17, 1, 'Exam 1 Q17: Which statement accurately characterizes two-phase locking under strict consistency guarantees?', 'Primary invariant for two-phase locking using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 17),
(18, 1, 'Exam 1 Q18: Which statement accurately characterizes B+Tree secondary indexing under strict consistency guarantees?', 'Primary invariant for B+Tree secondary indexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 18),
(19, 1, 'Exam 1 Q19: Which statement accurately characterizes write-ahead redo logging under strict consistency guarantees?', 'Primary invariant for write-ahead redo logging using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 19),
(20, 1, 'Exam 1 Q20: Which statement accurately characterizes InnoDB buffer pool flushing under strict consistency guarantees?', 'Primary invariant for InnoDB buffer pool flushing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 20),
(21, 2, 'Exam 2 Q1: Which statement accurately characterizes AES-GCM authenticated encryption under strict consistency guarantees?', 'Primary invariant for AES-GCM authenticated encryption using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 1),
(22, 2, 'Exam 2 Q2: Which statement accurately characterizes HMAC-SHA256 verification under strict consistency guarantees?', 'Primary invariant for HMAC-SHA256 verification using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 2),
(23, 2, 'Exam 2 Q3: Which statement accurately characterizes bcrypt adaptive work factor under strict consistency guarantees?', 'Primary invariant for bcrypt adaptive work factor using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 3),
(24, 2, 'Exam 2 Q4: Which statement accurately characterizes Ed25519 signature validation under strict consistency guarantees?', 'Primary invariant for Ed25519 signature validation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 4),
(25, 2, 'Exam 2 Q5: Which statement accurately characterizes TLS 1.3 key schedule under strict consistency guarantees?', 'Primary invariant for TLS 1.3 key schedule using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 5),
(26, 2, 'Exam 2 Q6: Which statement accurately characterizes AES-GCM authenticated encryption under strict consistency guarantees?', 'Primary invariant for AES-GCM authenticated encryption using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 6),
(27, 2, 'Exam 2 Q7: Which statement accurately characterizes HMAC-SHA256 verification under strict consistency guarantees?', 'Primary invariant for HMAC-SHA256 verification using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 7),
(28, 2, 'Exam 2 Q8: Which statement accurately characterizes bcrypt adaptive work factor under strict consistency guarantees?', 'Primary invariant for bcrypt adaptive work factor using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 8),
(29, 2, 'Exam 2 Q9: Which statement accurately characterizes Ed25519 signature validation under strict consistency guarantees?', 'Primary invariant for Ed25519 signature validation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 9),
(30, 2, 'Exam 2 Q10: Which statement accurately characterizes TLS 1.3 key schedule under strict consistency guarantees?', 'Primary invariant for TLS 1.3 key schedule using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 10),
(31, 2, 'Exam 2 Q11: Which statement accurately characterizes AES-GCM authenticated encryption under strict consistency guarantees?', 'Primary invariant for AES-GCM authenticated encryption using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 11),
(32, 2, 'Exam 2 Q12: Which statement accurately characterizes HMAC-SHA256 verification under strict consistency guarantees?', 'Primary invariant for HMAC-SHA256 verification using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 12),
(33, 2, 'Exam 2 Q13: Which statement accurately characterizes bcrypt adaptive work factor under strict consistency guarantees?', 'Primary invariant for bcrypt adaptive work factor using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 13),
(34, 2, 'Exam 2 Q14: Which statement accurately characterizes Ed25519 signature validation under strict consistency guarantees?', 'Primary invariant for Ed25519 signature validation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 14),
(35, 2, 'Exam 2 Q15: Which statement accurately characterizes TLS 1.3 key schedule under strict consistency guarantees?', 'Primary invariant for TLS 1.3 key schedule using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 15),
(36, 2, 'Exam 2 Q16: Which statement accurately characterizes AES-GCM authenticated encryption under strict consistency guarantees?', 'Primary invariant for AES-GCM authenticated encryption using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 16),
(37, 2, 'Exam 2 Q17: Which statement accurately characterizes HMAC-SHA256 verification under strict consistency guarantees?', 'Primary invariant for HMAC-SHA256 verification using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 17),
(38, 2, 'Exam 2 Q18: Which statement accurately characterizes bcrypt adaptive work factor under strict consistency guarantees?', 'Primary invariant for bcrypt adaptive work factor using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 18),
(39, 2, 'Exam 2 Q19: Which statement accurately characterizes Ed25519 signature validation under strict consistency guarantees?', 'Primary invariant for Ed25519 signature validation using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 19),
(40, 2, 'Exam 2 Q20: Which statement accurately characterizes TLS 1.3 key schedule under strict consistency guarantees?', 'Primary invariant for TLS 1.3 key schedule using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 20),
(41, 3, 'Exam 3 Q1: Which statement accurately characterizes multi-level page tables under strict consistency guarantees?', 'Primary invariant for multi-level page tables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 1),
(42, 3, 'Exam 3 Q2: Which statement accurately characterizes copy-on-write fork semantics under strict consistency guarantees?', 'Primary invariant for copy-on-write fork semantics using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 2),
(43, 3, 'Exam 3 Q3: Which statement accurately characterizes banker deadlock avoidance under strict consistency guarantees?', 'Primary invariant for banker deadlock avoidance using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 3),
(44, 3, 'Exam 3 Q4: Which statement accurately characterizes completely fair scheduler under strict consistency guarantees?', 'Primary invariant for completely fair scheduler using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 4),
(45, 3, 'Exam 3 Q5: Which statement accurately characterizes POSIX condition variables under strict consistency guarantees?', 'Primary invariant for POSIX condition variables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 5),
(46, 3, 'Exam 3 Q6: Which statement accurately characterizes multi-level page tables under strict consistency guarantees?', 'Primary invariant for multi-level page tables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 6),
(47, 3, 'Exam 3 Q7: Which statement accurately characterizes copy-on-write fork semantics under strict consistency guarantees?', 'Primary invariant for copy-on-write fork semantics using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 7),
(48, 3, 'Exam 3 Q8: Which statement accurately characterizes banker deadlock avoidance under strict consistency guarantees?', 'Primary invariant for banker deadlock avoidance using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 8),
(49, 3, 'Exam 3 Q9: Which statement accurately characterizes completely fair scheduler under strict consistency guarantees?', 'Primary invariant for completely fair scheduler using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 9),
(50, 3, 'Exam 3 Q10: Which statement accurately characterizes POSIX condition variables under strict consistency guarantees?', 'Primary invariant for POSIX condition variables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 10),
(51, 3, 'Exam 3 Q11: Which statement accurately characterizes multi-level page tables under strict consistency guarantees?', 'Primary invariant for multi-level page tables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 11),
(52, 3, 'Exam 3 Q12: Which statement accurately characterizes copy-on-write fork semantics under strict consistency guarantees?', 'Primary invariant for copy-on-write fork semantics using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 12),
(53, 3, 'Exam 3 Q13: Which statement accurately characterizes banker deadlock avoidance under strict consistency guarantees?', 'Primary invariant for banker deadlock avoidance using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 13),
(54, 3, 'Exam 3 Q14: Which statement accurately characterizes completely fair scheduler under strict consistency guarantees?', 'Primary invariant for completely fair scheduler using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 14),
(55, 3, 'Exam 3 Q15: Which statement accurately characterizes POSIX condition variables under strict consistency guarantees?', 'Primary invariant for POSIX condition variables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 15),
(56, 3, 'Exam 3 Q16: Which statement accurately characterizes multi-level page tables under strict consistency guarantees?', 'Primary invariant for multi-level page tables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 16),
(57, 3, 'Exam 3 Q17: Which statement accurately characterizes copy-on-write fork semantics under strict consistency guarantees?', 'Primary invariant for copy-on-write fork semantics using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 17),
(58, 3, 'Exam 3 Q18: Which statement accurately characterizes banker deadlock avoidance under strict consistency guarantees?', 'Primary invariant for banker deadlock avoidance using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 18),
(59, 3, 'Exam 3 Q19: Which statement accurately characterizes completely fair scheduler under strict consistency guarantees?', 'Primary invariant for completely fair scheduler using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 19),
(60, 3, 'Exam 3 Q20: Which statement accurately characterizes POSIX condition variables under strict consistency guarantees?', 'Primary invariant for POSIX condition variables using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 20),
(61, 4, 'Exam 4 Q1: Which statement accurately characterizes TCP CUBIC congestion window under strict consistency guarantees?', 'Primary invariant for TCP CUBIC congestion window using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 1),
(62, 4, 'Exam 4 Q2: Which statement accurately characterizes QUIC 0-RTT handshake under strict consistency guarantees?', 'Primary invariant for QUIC 0-RTT handshake using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 2),
(63, 4, 'Exam 4 Q3: Which statement accurately characterizes DNSSEC chain of trust under strict consistency guarantees?', 'Primary invariant for DNSSEC chain of trust using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 3),
(64, 4, 'Exam 4 Q4: Which statement accurately characterizes BGP path vector selection under strict consistency guarantees?', 'Primary invariant for BGP path vector selection using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 4),
(65, 4, 'Exam 4 Q5: Which statement accurately characterizes HTTP/3 stream multiplexing under strict consistency guarantees?', 'Primary invariant for HTTP/3 stream multiplexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 5),
(66, 4, 'Exam 4 Q6: Which statement accurately characterizes TCP CUBIC congestion window under strict consistency guarantees?', 'Primary invariant for TCP CUBIC congestion window using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 6),
(67, 4, 'Exam 4 Q7: Which statement accurately characterizes QUIC 0-RTT handshake under strict consistency guarantees?', 'Primary invariant for QUIC 0-RTT handshake using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 7),
(68, 4, 'Exam 4 Q8: Which statement accurately characterizes DNSSEC chain of trust under strict consistency guarantees?', 'Primary invariant for DNSSEC chain of trust using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 8),
(69, 4, 'Exam 4 Q9: Which statement accurately characterizes BGP path vector selection under strict consistency guarantees?', 'Primary invariant for BGP path vector selection using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 9),
(70, 4, 'Exam 4 Q10: Which statement accurately characterizes HTTP/3 stream multiplexing under strict consistency guarantees?', 'Primary invariant for HTTP/3 stream multiplexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 10),
(71, 4, 'Exam 4 Q11: Which statement accurately characterizes TCP CUBIC congestion window under strict consistency guarantees?', 'Primary invariant for TCP CUBIC congestion window using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 11),
(72, 4, 'Exam 4 Q12: Which statement accurately characterizes QUIC 0-RTT handshake under strict consistency guarantees?', 'Primary invariant for QUIC 0-RTT handshake using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 12),
(73, 4, 'Exam 4 Q13: Which statement accurately characterizes DNSSEC chain of trust under strict consistency guarantees?', 'Primary invariant for DNSSEC chain of trust using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 13),
(74, 4, 'Exam 4 Q14: Which statement accurately characterizes BGP path vector selection under strict consistency guarantees?', 'Primary invariant for BGP path vector selection using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 14),
(75, 4, 'Exam 4 Q15: Which statement accurately characterizes HTTP/3 stream multiplexing under strict consistency guarantees?', 'Primary invariant for HTTP/3 stream multiplexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 15),
(76, 4, 'Exam 4 Q16: Which statement accurately characterizes TCP CUBIC congestion window under strict consistency guarantees?', 'Primary invariant for TCP CUBIC congestion window using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 16),
(77, 4, 'Exam 4 Q17: Which statement accurately characterizes QUIC 0-RTT handshake under strict consistency guarantees?', 'Primary invariant for QUIC 0-RTT handshake using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'B', 2.00, 17),
(78, 4, 'Exam 4 Q18: Which statement accurately characterizes DNSSEC chain of trust under strict consistency guarantees?', 'Primary invariant for DNSSEC chain of trust using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'C', 2.00, 18),
(79, 4, 'Exam 4 Q19: Which statement accurately characterizes BGP path vector selection under strict consistency guarantees?', 'Primary invariant for BGP path vector selection using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'D', 2.00, 19),
(80, 4, 'Exam 4 Q20: Which statement accurately characterizes HTTP/3 stream multiplexing under strict consistency guarantees?', 'Primary invariant for HTTP/3 stream multiplexing using deterministic state validation', 'Lock-free heuristic fallback bypassing transactional atomicity', 'Unverified client-side cache state without durability barrier', 'Sequential full-scan override without index selectivity', 'A', 2.00, 20);

-- 40 Exam_Sessions (initialized IN_PROGRESS with future deadline so triggers/procedures validate responses & logs)
INSERT INTO Exam_Sessions (id, exam_id, student_id, trust_score, status, started_at, server_deadline, last_heartbeat_at) VALUES
(1, 1, 6, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 16 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(2, 1, 7, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 17 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(3, 1, 8, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 18 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(4, 1, 9, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 19 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(5, 1, 10, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 20 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(6, 1, 11, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 21 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(7, 1, 12, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 22 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(8, 1, 13, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 23 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(9, 1, 14, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 24 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(10, 1, 15, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 25 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(11, 1, 16, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 26 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(12, 1, 17, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 27 MINUTE), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(13, 3, 5, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 121 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(14, 3, 6, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 146 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(15, 3, 7, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 123 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(16, 3, 8, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 148 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(17, 3, 9, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 125 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(18, 3, 10, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 150 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(19, 3, 11, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 127 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(20, 3, 12, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 152 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(21, 3, 13, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 129 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(22, 3, 14, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 154 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(23, 3, 15, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 131 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(24, 3, 16, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 144 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(25, 3, 17, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 121 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(26, 3, 18, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 146 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(27, 4, 19, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 75 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(28, 4, 20, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 100 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(29, 4, 21, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 77 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(30, 4, 22, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 102 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(31, 4, 23, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 79 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(32, 4, 24, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 104 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(33, 4, 25, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 81 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(34, 4, 26, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 106 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(35, 4, 27, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 83 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(36, 4, 28, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 96 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(37, 4, 29, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 73 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(38, 4, 30, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 98 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(39, 4, 31, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 75 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW()),
(40, 4, 32, 100, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 100 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), NOW());

-- Student_Responses (12 answers per session = 480 responses)
INSERT INTO Student_Responses (session_id, question_id, selected_option) VALUES
(1, 1, 'C'),
(1, 2, 'D'),
(1, 3, 'A'),
(1, 4, 'C'),
(1, 5, 'C'),
(1, 6, 'D'),
(1, 7, 'A'),
(1, 8, 'B'),
(1, 9, 'D'),
(1, 10, 'D'),
(1, 11, 'A'),
(1, 12, 'B'),
(2, 1, 'C'),
(2, 2, 'D'),
(2, 3, 'B'),
(2, 4, 'B'),
(2, 5, 'C'),
(2, 6, 'D'),
(2, 7, 'A'),
(2, 8, 'C'),
(2, 9, 'C'),
(2, 10, 'D'),
(2, 11, 'A'),
(2, 12, 'B'),
(3, 1, 'C'),
(3, 2, 'A'),
(3, 3, 'A'),
(3, 4, 'B'),
(3, 5, 'C'),
(3, 6, 'D'),
(3, 7, 'B'),
(3, 8, 'B'),
(3, 9, 'C'),
(3, 10, 'D'),
(3, 11, 'A'),
(3, 12, 'C'),
(4, 1, 'D'),
(4, 2, 'D'),
(4, 3, 'A'),
(4, 4, 'B'),
(4, 5, 'C'),
(4, 6, 'A'),
(4, 7, 'A'),
(4, 8, 'B'),
(4, 9, 'C'),
(4, 10, 'D'),
(4, 11, 'B'),
(4, 12, 'B'),
(5, 1, 'C'),
(5, 2, 'D'),
(5, 3, 'A'),
(5, 4, 'B'),
(5, 5, 'D'),
(5, 6, 'D'),
(5, 7, 'A'),
(5, 8, 'B'),
(5, 9, 'C'),
(5, 10, 'A'),
(5, 11, 'A'),
(5, 12, 'B'),
(6, 1, 'C'),
(6, 2, 'D'),
(6, 3, 'A'),
(6, 4, 'C'),
(6, 5, 'C'),
(6, 6, 'D'),
(6, 7, 'A'),
(6, 8, 'B'),
(6, 9, 'D'),
(6, 10, 'D'),
(6, 11, 'A'),
(6, 12, 'B'),
(7, 1, 'C'),
(7, 2, 'D'),
(7, 3, 'B'),
(7, 4, 'B'),
(7, 5, 'C'),
(7, 6, 'D'),
(7, 7, 'A'),
(7, 8, 'C'),
(7, 9, 'C'),
(7, 10, 'D'),
(7, 11, 'A'),
(7, 12, 'B'),
(8, 1, 'C'),
(8, 2, 'A'),
(8, 3, 'A'),
(8, 4, 'B'),
(8, 5, 'C'),
(8, 6, 'D'),
(8, 7, 'B'),
(8, 8, 'B'),
(8, 9, 'C'),
(8, 10, 'D'),
(8, 11, 'A'),
(8, 12, 'C'),
(9, 1, 'D'),
(9, 2, 'D'),
(9, 3, 'A'),
(9, 4, 'B'),
(9, 5, 'C'),
(9, 6, 'A'),
(9, 7, 'A'),
(9, 8, 'B'),
(9, 9, 'C'),
(9, 10, 'D'),
(9, 11, 'B'),
(9, 12, 'B'),
(10, 1, 'C'),
(10, 2, 'D'),
(10, 3, 'A'),
(10, 4, 'B'),
(10, 5, 'D'),
(10, 6, 'D'),
(10, 7, 'A'),
(10, 8, 'B'),
(10, 9, 'C'),
(10, 10, 'A'),
(10, 11, 'A'),
(10, 12, 'B'),
(11, 1, 'C'),
(11, 2, 'D'),
(11, 3, 'A'),
(11, 4, 'C'),
(11, 5, 'C'),
(11, 6, 'D'),
(11, 7, 'A'),
(11, 8, 'B'),
(11, 9, 'D'),
(11, 10, 'D'),
(11, 11, 'A'),
(11, 12, 'B'),
(12, 1, 'C'),
(12, 2, 'D'),
(12, 3, 'B'),
(12, 4, 'B'),
(12, 5, 'C'),
(12, 6, 'D'),
(12, 7, 'A'),
(12, 8, 'C'),
(12, 9, 'C'),
(12, 10, 'D'),
(12, 11, 'A'),
(12, 12, 'B'),
(13, 41, 'A'),
(13, 42, 'C'),
(13, 43, 'C'),
(13, 44, 'D'),
(13, 45, 'A'),
(13, 46, 'B'),
(13, 47, 'D'),
(13, 48, 'D'),
(13, 49, 'A'),
(13, 50, 'B'),
(13, 51, 'C'),
(13, 52, 'A'),
(14, 41, 'B'),
(14, 42, 'B'),
(14, 43, 'C'),
(14, 44, 'D'),
(14, 45, 'A'),
(14, 46, 'C'),
(14, 47, 'C'),
(14, 48, 'D'),
(14, 49, 'A'),
(14, 50, 'B'),
(14, 51, 'D'),
(14, 52, 'D'),
(15, 41, 'A'),
(15, 42, 'B'),
(15, 43, 'C'),
(15, 44, 'D'),
(15, 45, 'B'),
(15, 46, 'B'),
(15, 47, 'C'),
(15, 48, 'D'),
(15, 49, 'A'),
(15, 50, 'C'),
(15, 51, 'C'),
(15, 52, 'D'),
(16, 41, 'A'),
(16, 42, 'B'),
(16, 43, 'C'),
(16, 44, 'A'),
(16, 45, 'A'),
(16, 46, 'B'),
(16, 47, 'C'),
(16, 48, 'D'),
(16, 49, 'B'),
(16, 50, 'B'),
(16, 51, 'C'),
(16, 52, 'D'),
(17, 41, 'A'),
(17, 42, 'B'),
(17, 43, 'D'),
(17, 44, 'D'),
(17, 45, 'A'),
(17, 46, 'B'),
(17, 47, 'C'),
(17, 48, 'A'),
(17, 49, 'A'),
(17, 50, 'B'),
(17, 51, 'C'),
(17, 52, 'D'),
(18, 41, 'A'),
(18, 42, 'C'),
(18, 43, 'C'),
(18, 44, 'D'),
(18, 45, 'A'),
(18, 46, 'B'),
(18, 47, 'D'),
(18, 48, 'D'),
(18, 49, 'A'),
(18, 50, 'B'),
(18, 51, 'C'),
(18, 52, 'A'),
(19, 41, 'B'),
(19, 42, 'B'),
(19, 43, 'C'),
(19, 44, 'D'),
(19, 45, 'A'),
(19, 46, 'C'),
(19, 47, 'C'),
(19, 48, 'D'),
(19, 49, 'A'),
(19, 50, 'B'),
(19, 51, 'D'),
(19, 52, 'D'),
(20, 41, 'A'),
(20, 42, 'B'),
(20, 43, 'C'),
(20, 44, 'D'),
(20, 45, 'B'),
(20, 46, 'B'),
(20, 47, 'C'),
(20, 48, 'D'),
(20, 49, 'A'),
(20, 50, 'C'),
(20, 51, 'C'),
(20, 52, 'D'),
(21, 41, 'A'),
(21, 42, 'B'),
(21, 43, 'C'),
(21, 44, 'A'),
(21, 45, 'A'),
(21, 46, 'B'),
(21, 47, 'C'),
(21, 48, 'D'),
(21, 49, 'B'),
(21, 50, 'B'),
(21, 51, 'C'),
(21, 52, 'D'),
(22, 41, 'A'),
(22, 42, 'B'),
(22, 43, 'D'),
(22, 44, 'D'),
(22, 45, 'A'),
(22, 46, 'B'),
(22, 47, 'C'),
(22, 48, 'A'),
(22, 49, 'A'),
(22, 50, 'B'),
(22, 51, 'C'),
(22, 52, 'D'),
(23, 41, 'A'),
(23, 42, 'C'),
(23, 43, 'C'),
(23, 44, 'D'),
(23, 45, 'A'),
(23, 46, 'B'),
(23, 47, 'D'),
(23, 48, 'D'),
(23, 49, 'A'),
(23, 50, 'B'),
(23, 51, 'C'),
(23, 52, 'A'),
(24, 41, 'B'),
(24, 42, 'B'),
(24, 43, 'C'),
(24, 44, 'D'),
(24, 45, 'A'),
(24, 46, 'C'),
(24, 47, 'C'),
(24, 48, 'D'),
(24, 49, 'A'),
(24, 50, 'B'),
(24, 51, 'D'),
(24, 52, 'D'),
(25, 41, 'A'),
(25, 42, 'B'),
(25, 43, 'C'),
(25, 44, 'D'),
(25, 45, 'B'),
(25, 46, 'B'),
(25, 47, 'C'),
(25, 48, 'D'),
(25, 49, 'A'),
(25, 50, 'C'),
(25, 51, 'C'),
(25, 52, 'D'),
(26, 41, 'A'),
(26, 42, 'B'),
(26, 43, 'C'),
(26, 44, 'A'),
(26, 45, 'A'),
(26, 46, 'B'),
(26, 47, 'C'),
(26, 48, 'D'),
(26, 49, 'B'),
(26, 50, 'B'),
(26, 51, 'C'),
(26, 52, 'D'),
(27, 61, 'B'),
(27, 62, 'C'),
(27, 63, 'A'),
(27, 64, 'A'),
(27, 65, 'B'),
(27, 66, 'C'),
(27, 67, 'D'),
(27, 68, 'B'),
(27, 69, 'B'),
(27, 70, 'C'),
(27, 71, 'D'),
(27, 72, 'A'),
(28, 61, 'B'),
(28, 62, 'D'),
(28, 63, 'D'),
(28, 64, 'A'),
(28, 65, 'B'),
(28, 66, 'C'),
(28, 67, 'A'),
(28, 68, 'A'),
(28, 69, 'B'),
(28, 70, 'C'),
(28, 71, 'D'),
(28, 72, 'B'),
(29, 61, 'C'),
(29, 62, 'C'),
(29, 63, 'D'),
(29, 64, 'A'),
(29, 65, 'B'),
(29, 66, 'D'),
(29, 67, 'D'),
(29, 68, 'A'),
(29, 69, 'B'),
(29, 70, 'C'),
(29, 71, 'A'),
(29, 72, 'A'),
(30, 61, 'B'),
(30, 62, 'C'),
(30, 63, 'D'),
(30, 64, 'A'),
(30, 65, 'C'),
(30, 66, 'C'),
(30, 67, 'D'),
(30, 68, 'A'),
(30, 69, 'B'),
(30, 70, 'D'),
(30, 71, 'D'),
(30, 72, 'A'),
(31, 61, 'B'),
(31, 62, 'C'),
(31, 63, 'D'),
(31, 64, 'B'),
(31, 65, 'B'),
(31, 66, 'C'),
(31, 67, 'D'),
(31, 68, 'A'),
(31, 69, 'C'),
(31, 70, 'C'),
(31, 71, 'D'),
(31, 72, 'A'),
(32, 61, 'B'),
(32, 62, 'C'),
(32, 63, 'A'),
(32, 64, 'A'),
(32, 65, 'B'),
(32, 66, 'C'),
(32, 67, 'D'),
(32, 68, 'B'),
(32, 69, 'B'),
(32, 70, 'C'),
(32, 71, 'D'),
(32, 72, 'A'),
(33, 61, 'B'),
(33, 62, 'D'),
(33, 63, 'D'),
(33, 64, 'A'),
(33, 65, 'B'),
(33, 66, 'C'),
(33, 67, 'A'),
(33, 68, 'A'),
(33, 69, 'B'),
(33, 70, 'C'),
(33, 71, 'D'),
(33, 72, 'B'),
(34, 61, 'C'),
(34, 62, 'C'),
(34, 63, 'D'),
(34, 64, 'A'),
(34, 65, 'B'),
(34, 66, 'D'),
(34, 67, 'D'),
(34, 68, 'A'),
(34, 69, 'B'),
(34, 70, 'C'),
(34, 71, 'A'),
(34, 72, 'A'),
(35, 61, 'B'),
(35, 62, 'C'),
(35, 63, 'D'),
(35, 64, 'A'),
(35, 65, 'C'),
(35, 66, 'C'),
(35, 67, 'D'),
(35, 68, 'A'),
(35, 69, 'B'),
(35, 70, 'D'),
(35, 71, 'D'),
(35, 72, 'A'),
(36, 61, 'B'),
(36, 62, 'C'),
(36, 63, 'D'),
(36, 64, 'B'),
(36, 65, 'B'),
(36, 66, 'C'),
(36, 67, 'D'),
(36, 68, 'A'),
(36, 69, 'C'),
(36, 70, 'C'),
(36, 71, 'D'),
(36, 72, 'A'),
(37, 61, 'B'),
(37, 62, 'C'),
(37, 63, 'A'),
(37, 64, 'A'),
(37, 65, 'B'),
(37, 66, 'C'),
(37, 67, 'D'),
(37, 68, 'B'),
(37, 69, 'B'),
(37, 70, 'C'),
(37, 71, 'D'),
(37, 72, 'A'),
(38, 61, 'B'),
(38, 62, 'D'),
(38, 63, 'D'),
(38, 64, 'A'),
(38, 65, 'B'),
(38, 66, 'C'),
(38, 67, 'A'),
(38, 68, 'A'),
(38, 69, 'B'),
(38, 70, 'C'),
(38, 71, 'D'),
(38, 72, 'B'),
(39, 61, 'C'),
(39, 62, 'C'),
(39, 63, 'D'),
(39, 64, 'A'),
(39, 65, 'B'),
(39, 66, 'D'),
(39, 67, 'D'),
(39, 68, 'A'),
(39, 69, 'B'),
(39, 70, 'C'),
(39, 71, 'A'),
(39, 72, 'A'),
(40, 61, 'B'),
(40, 62, 'C'),
(40, 63, 'D'),
(40, 64, 'A'),
(40, 65, 'C'),
(40, 66, 'C'),
(40, 67, 'D'),
(40, 68, 'A'),
(40, 69, 'B'),
(40, 70, 'D'),
(40, 71, 'D'),
(40, 72, 'A');

-- 300 Proctoring_Logs spread across the past 30 days (firing triggers)
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (1, 1, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 0 DAY), INTERVAL 600 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 1;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (2, 1, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 0 DAY), INTERVAL 791 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (3, 1, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 0 DAY), INTERVAL 982 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 1;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (4, 1, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 0 DAY), INTERVAL 1173 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 4;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 2;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (5, 1, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 1 DAY), INTERVAL 1364 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 3;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (6, 1, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 1 DAY), INTERVAL 115 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 4;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (7, 1, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 1 DAY), INTERVAL 246 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 7;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 5;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 6;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (8, 1, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 437 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (9, 2, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 667 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 9;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (10, 2, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 858 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (11, 2, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 1049 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 9;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (12, 2, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 1240 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 12;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 10;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (13, 2, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 1431 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 11;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (14, 2, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 122 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 12;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 13;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (15, 2, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 313 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 15;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 14;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (16, 2, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 504 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (17, 3, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 734 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 17;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (18, 3, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 925 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (19, 3, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 2 DAY), INTERVAL 1116 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 17;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (20, 3, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 1307 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 20;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 18;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (21, 3, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 58 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 19;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 20;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (22, 3, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 189 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 21;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (23, 3, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 380 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 23;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 22;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (24, 3, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 571 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (25, 4, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 801 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 25;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (26, 4, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 992 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (27, 4, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 1183 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 25;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (28, 4, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 1374 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 28;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 26;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 27;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (29, 4, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 65 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 28;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (30, 4, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 256 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 29;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (31, 4, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 447 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 31;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (32, 4, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 638 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (33, 5, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 3 DAY), INTERVAL 868 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 33;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (34, 5, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1059 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (35, 5, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1250 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 33;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 34;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (36, 5, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1381 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 36;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 35;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (37, 5, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 132 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 36;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (38, 5, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 323 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (39, 5, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 514 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 39;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 37;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (40, 5, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 705 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (41, 6, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 935 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 41;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (42, 6, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1126 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 41;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (43, 6, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1317 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 42;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (44, 6, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 8 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 44;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 43;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (45, 6, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 199 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (46, 6, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 390 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 44;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (47, 6, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 581 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 47;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 45;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (48, 6, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 772 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (49, 7, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 642 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 49;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (50, 7, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 833 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 49;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (51, 7, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 964 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 50;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (52, 7, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1155 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 52;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (53, 7, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 4 DAY), INTERVAL 1346 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 51;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (54, 7, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 97 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 52;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (55, 7, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 288 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 55;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 53;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (56, 7, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 479 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (57, 8, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 709 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 57;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (58, 8, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 840 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 57;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (59, 8, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 1031 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (60, 8, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 1222 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 60;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 58;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (61, 8, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 1413 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 59;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (62, 8, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 164 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 60;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (63, 8, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 355 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 63;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 61;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (64, 8, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 5 DAY), INTERVAL 486 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (65, 9, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 776 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 65;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (66, 9, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 907 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (67, 9, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 1098 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 65;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (68, 9, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 1289 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 68;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 66;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (69, 9, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 40 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 67;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (70, 9, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 231 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 68;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (71, 9, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 362 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 71;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 69;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 70;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (72, 9, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 553 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (73, 10, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 783 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 73;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (74, 10, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 6 DAY), INTERVAL 974 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (75, 10, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 7 DAY), INTERVAL 1165 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 73;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (76, 10, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 7 DAY), INTERVAL 1356 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 76;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 74;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (77, 10, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 7 DAY), INTERVAL 107 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 75;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (78, 10, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 8 DAY), INTERVAL 298 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 76;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 77;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (79, 10, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 8 DAY), INTERVAL 429 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 79;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 78;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (80, 10, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 8 DAY), INTERVAL 620 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (81, 11, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 8 DAY), INTERVAL 850 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 81;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (82, 11, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 1041 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (83, 11, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 1232 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 81;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (84, 11, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 1423 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 84;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (85, 11, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 174 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 82;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (86, 11, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 305 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (87, 11, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 496 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 87;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (88, 11, 6, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 687 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (89, 12, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 917 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 89;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (90, 12, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 1108 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (91, 12, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 1299 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 89;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (92, 12, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 50 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 92;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 90;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 91;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (93, 12, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 181 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 92;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (94, 12, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 372 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 93;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (95, 12, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 9 DAY), INTERVAL 563 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 95;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (96, 12, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 754 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (97, 13, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 24 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 97;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (98, 13, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 215 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (99, 13, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 406 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 97;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 98;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (100, 13, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 597 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 100;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 99;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (101, 13, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 728 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 100;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (102, 13, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 919 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (103, 13, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 1110 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 103;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 101;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (104, 13, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 1301 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (105, 14, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 151 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 105;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (106, 14, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 342 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 105;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (107, 14, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 533 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 106;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (108, 14, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 10 DAY), INTERVAL 664 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 108;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 107;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (109, 14, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 855 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (110, 14, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1046 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 108;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (111, 14, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1237 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 111;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 109;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (112, 14, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1428 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (113, 15, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 278 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 113;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (114, 15, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 469 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 113;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (115, 15, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 600 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 114;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (116, 15, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 791 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 116;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (117, 15, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 982 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 115;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (118, 15, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1173 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 116;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (119, 15, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1364 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 119;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 117;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (120, 15, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 115 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (121, 16, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 405 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 121;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (122, 16, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 596 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 121;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (123, 16, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 727 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (124, 16, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 918 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 124;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 122;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (125, 16, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1109 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 123;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (126, 16, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 11 DAY), INTERVAL 1300 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 124;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (127, 16, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 51 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 127;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 125;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (128, 16, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 182 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (129, 17, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 532 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 129;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (130, 17, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 663 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (131, 17, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 854 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 129;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (132, 17, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 1045 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 132;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 130;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (133, 17, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 1236 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 131;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (134, 17, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 1427 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 132;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (135, 17, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 178 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 135;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 133;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 134;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (136, 17, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 309 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (137, 18, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 12 DAY), INTERVAL 659 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 137;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (138, 18, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 790 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (139, 18, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 981 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 137;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (140, 18, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 1172 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 140;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 138;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (141, 18, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 1363 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 139;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (142, 18, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 114 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 140;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 141;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (143, 18, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 245 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 143;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 142;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (144, 18, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 436 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (145, 19, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 726 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 145;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (146, 19, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 917 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (147, 19, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 13 DAY), INTERVAL 1108 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 145;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (148, 19, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 15 DAY), INTERVAL 1299 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 148;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 146;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (149, 19, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 15 DAY), INTERVAL 50 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 147;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 148;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (150, 19, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 15 DAY), INTERVAL 181 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 149;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (151, 19, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 15 DAY), INTERVAL 372 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 151;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 150;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (152, 19, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 563 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (153, 20, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 853 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 153;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (154, 20, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 1044 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (155, 20, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 1235 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 153;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (156, 20, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 1426 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 156;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 154;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 155;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (157, 20, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 177 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 156;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (158, 20, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 308 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 157;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (159, 20, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 499 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 159;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (160, 20, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 690 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 8), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (161, 21, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 980 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 161;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (162, 21, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 1171 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (163, 21, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 1362 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 161;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 162;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (164, 21, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 16 DAY), INTERVAL 113 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 164;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 163;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (165, 21, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 244 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 164;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (166, 21, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 435 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (167, 21, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 626 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (168, 22, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 1107 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 168;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (169, 22, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 1298 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (170, 22, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 49 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (171, 22, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 180 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 171;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 168;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (172, 22, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 371 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 169;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (173, 22, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 562 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (174, 22, 6, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 753 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (175, 23, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 1234 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 175;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (176, 23, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 1425 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 175;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (177, 23, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 176 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 176;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (178, 23, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 307 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 178;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (179, 23, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 17 DAY), INTERVAL 498 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (180, 23, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 689 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (181, 23, 6, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 880 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (182, 24, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 1361 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 182;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (183, 24, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 112 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 182;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (184, 24, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 243 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (185, 24, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 434 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 185;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (186, 24, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 625 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 183;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (187, 24, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 816 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (188, 24, 6, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 1007 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (189, 25, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 48 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 189;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (190, 25, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 239 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (191, 25, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 370 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 189;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (192, 25, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 561 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 192;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 190;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (193, 25, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 752 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 191;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (194, 25, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 943 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 192;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (195, 25, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 1134 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (196, 26, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 175 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 196;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (197, 26, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 306 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (198, 26, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 497 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 196;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (199, 26, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 688 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 199;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 197;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (200, 26, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 879 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 198;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (201, 26, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 1070 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 199;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 200;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (202, 26, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 18 DAY), INTERVAL 1201 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (203, 27, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 62 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 203;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (204, 27, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 253 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (205, 27, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 444 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 203;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (206, 27, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 635 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 206;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 204;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (207, 27, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 826 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 205;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 206;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 207;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (208, 27, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 1017 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (209, 27, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 1148 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (210, 28, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 249 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 210;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (211, 28, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 440 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (212, 28, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 631 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 210;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (213, 28, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 19 DAY), INTERVAL 822 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 213;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 211;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 212;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 213;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (214, 28, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 1013 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (215, 28, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 1144 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 214;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (216, 28, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 1335 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (217, 29, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 436 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 217;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (218, 29, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 627 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (219, 29, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 818 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 217;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 218;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 219;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (220, 29, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 1009 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 220;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (221, 29, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 1140 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 220;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (222, 29, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 1331 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (223, 29, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 20 DAY), INTERVAL 82 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (224, 30, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 21 DAY), INTERVAL 623 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 224;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (225, 30, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 21 DAY), INTERVAL 814 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 224;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 225;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (226, 30, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 21 DAY), INTERVAL 1005 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (227, 30, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 22 DAY), INTERVAL 1196 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 227;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 226;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (228, 30, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 22 DAY), INTERVAL 1327 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (229, 30, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 22 DAY), INTERVAL 78 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 227;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 228;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (230, 30, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 22 DAY), INTERVAL 269 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (231, 31, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 810 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 231;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 231;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (232, 31, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 1001 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (233, 31, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 1192 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 232;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (234, 31, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 1323 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 234;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (235, 31, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 74 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 233;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 234;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (236, 31, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 265 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (237, 31, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 456 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (238, 32, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 997 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 238;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (239, 32, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 1188 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 238;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (240, 32, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 1379 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (241, 32, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 70 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 241;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 239;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 240;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (242, 32, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 23 DAY), INTERVAL 261 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (243, 32, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 452 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 241;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (244, 32, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 643 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (245, 33, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 1184 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 245;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (246, 33, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 1375 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (247, 33, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 66 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 245;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 246;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (248, 33, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 257 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 248;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (249, 33, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 448 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 247;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (250, 33, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 639 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 248;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (251, 33, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 830 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (252, 34, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 1371 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 252;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (253, 34, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 62 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 252;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (254, 34, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 253 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (255, 34, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 444 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 255;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 253;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (256, 34, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 24 DAY), INTERVAL 635 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 254;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (257, 34, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 826 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 255;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 256;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 257;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (258, 34, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1017 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (259, 35, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 118 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 259;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (260, 35, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 249 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (261, 35, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 440 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 259;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (262, 35, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 631 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 262;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 260;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (263, 35, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 822 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 261;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 262;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 263;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (264, 35, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1013 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (265, 35, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1144 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (266, 36, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 245 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 266;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (267, 36, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 436 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (268, 36, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 627 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 266;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (269, 36, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 818 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 269;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 267;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 268;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 269;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (270, 36, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1009 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (271, 36, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1140 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 270;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (272, 36, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1331 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (273, 37, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 432 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 273;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (274, 37, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 623 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (275, 37, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 814 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 273;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (276, 37, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 25 DAY), INTERVAL 1005 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 276;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 274;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (277, 37, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 1196 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (278, 37, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 1327 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (279, 37, 6, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 78 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (280, 38, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 619 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 280;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (281, 38, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 810 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (282, 38, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 1001 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 280;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (283, 38, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 1192 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 283;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (284, 38, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 1323 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 281;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (285, 38, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 74 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (286, 38, 6, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 26 DAY), INTERVAL 265 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (287, 39, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 806 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 287;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 287;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (288, 39, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 997 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (289, 39, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 1188 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 288;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (290, 39, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 1379 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 290;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (291, 39, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 70 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 289;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 290;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (292, 39, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 261 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (293, 39, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 452 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (294, 40, 5, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 993 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 1), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 294;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (295, 40, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 27 DAY), INTERVAL 1184 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 2), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 294;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (296, 40, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 28 DAY), INTERVAL 1375 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 3), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (297, 40, 2, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 28 DAY), INTERVAL 66 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 4), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'CONFIRMED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'Verified by proctor' WHERE id = 297;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 3, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 295;
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 4, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 296;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (298, 40, 4, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 29 DAY), INTERVAL 257 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 5), 'PENDING');
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (299, 40, 3, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 29 DAY), INTERVAL 448 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 6), 'PENDING');
UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED', reviewed_by = 2, reviewed_at = NOW(), review_notes = 'False positive cleared on audit' WHERE id = 297;
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES (300, 40, 1, DATE_ADD(DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00'), INTERVAL 29 DAY), INTERVAL 639 MINUTE), JSON_OBJECT('sensor', 'telemetry', 'seq', 7), 'PENDING');

-- Grade all completed, timed-out, and terminated sessions via sp_SubmitAndGradeExam
CALL sp_SubmitAndGradeExam(9, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(10, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(11, 'AUTO_TERMINATED');
CALL sp_SubmitAndGradeExam(13, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(14, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(15, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(16, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(17, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(18, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(19, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(20, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(21, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(22, 'AUTO_TERMINATED');
CALL sp_SubmitAndGradeExam(23, 'AUTO_TERMINATED');
CALL sp_SubmitAndGradeExam(24, 'AUTO_TERMINATED');
CALL sp_SubmitAndGradeExam(25, 'TIMEOUT');
CALL sp_SubmitAndGradeExam(26, 'TIMEOUT');
CALL sp_SubmitAndGradeExam(27, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(28, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(29, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(30, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(31, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(32, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(33, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(34, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(35, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(36, 'STUDENT_SUBMIT');
CALL sp_SubmitAndGradeExam(37, 'AUTO_TERMINATED');
CALL sp_SubmitAndGradeExam(38, 'AUTO_TERMINATED');
CALL sp_SubmitAndGradeExam(39, 'TIMEOUT');
CALL sp_SubmitAndGradeExam(40, 'TIMEOUT');

-- Backdate server_deadline & ended_at on finished/expired sessions
UPDATE Exam_Sessions SET started_at = DATE_SUB(NOW(), INTERVAL 90 MINUTE), server_deadline = DATE_SUB(NOW(), INTERVAL 30 MINUTE) WHERE id = 12;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 13;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 13;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 14;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 14;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 15;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 15;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 16;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 16;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 17;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 17;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 18;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 18;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 19;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 19;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 20;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 20;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 21;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 21;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 22;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 22;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 23;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 23;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 24;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 24;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 25;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE session_id = 25;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 26;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 6 DAY) WHERE session_id = 26;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 27;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 27;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 28;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 28;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 29;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 29;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 30;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 30;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 31;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 31;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 32;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 32;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 33;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 33;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 34;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 34;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 35;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 35;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 36;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 36;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 37;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 37;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 38;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 38;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 39;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE session_id = 39;
UPDATE Exam_Sessions SET server_deadline = DATE_ADD(started_at, INTERVAL 60 MINUTE), ended_at = DATE_ADD(started_at, INTERVAL 42 MINUTE) WHERE id = 40;
UPDATE Results SET graded_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE session_id = 40;
