-- ============================================================================
-- ProctorIQ Test Database Seed Data (Minimal Fixture Set)
-- Target: exam_monitoring_test
-- Demo password for all test accounts: ProctorIQ#2026
-- ============================================================================

USE exam_monitoring_test;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Time_Extension_Requests;
TRUNCATE TABLE Results;
TRUNCATE TABLE Proctoring_Logs;
TRUNCATE TABLE Student_Responses;
TRUNCATE TABLE Exam_Sessions;
TRUNCATE TABLE Questions;
TRUNCATE TABLE Exams;
TRUNCATE TABLE Users;
SET FOREIGN_KEY_CHECKS = 1;

-- Seed Users: 1 Admin, 2 Proctors, 5 Students
INSERT INTO Users (id, full_name, email, password_hash, role, is_active) VALUES
(1, 'Dr. Elena Vance', 'admin@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'ADMIN', TRUE),
(2, 'Marcus Sterling', 'proctor@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'PROCTOR', TRUE),
(3, 'Priya Nair', 'proctor2@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'PROCTOR', TRUE),
(4, 'Aarav Chen', 'student@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(5, 'Sophia O''Connor', 'student2@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(6, 'Liam Patel', 'student3@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(7, 'Maya Alvarez', 'student4@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE),
(8, 'Noah Brooks', 'student5@proctoriq.io', '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2', 'STUDENT', TRUE);

-- Seed Exams: 1 Published (#1), 1 Draft (#2), 1 Closed (#3)
INSERT INTO Exams (id, title, description, duration_minutes, min_trust_score, max_extension_mins, start_window, end_window, is_published, created_by) VALUES
(1, 'CS-401: Distributed Database Systems & ACID Internals',
 'Comprehensive assessment covering distributed database transactions, 2PC, Raft consensus, and snapshot isolation guarantees.',
 60, 30, 30, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY), TRUE, 1),
(2, 'SEC-305: Applied Cryptography & Zero-Knowledge Proofs',
 'Foundations of zero-knowledge SNARKs, lattice-based post-quantum cryptography, and elliptic curve signature schemes.',
 45, 60, 20, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 14 DAY), FALSE, 1),
(3, 'NET-220: Computer Networks & Transport Protocols',
 'Completed exam evaluating TCP congestion control, TLS 1.3 handshakes, and BGP routing.',
 50, 55, 0, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), TRUE, 1);

-- Seed Questions for Exam 1 (4 questions)
INSERT INTO Questions (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index) VALUES
(1, 1, 'What does the ACID acronym stand for in relational database management systems?',
 'Atomicity Consistency Isolation Durability',
 'Automatic Centralized Integrated Data',
 'Array Cluster Index Database',
 'Access Control Identity Domain',
 'A', 2.00, 1),
(2, 1, 'Which SQL transaction isolation level guarantees prevention of phantom reads in ANSI/ISO SQL?',
 'READ UNCOMMITTED',
 'READ COMMITTED',
 'REPEATABLE READ',
 'SERIALIZABLE',
 'D', 3.00, 2),
(3, 1, 'In the Raft consensus algorithm, which RPC is used by the leader to replicate log entries and serve as a heartbeat?',
 'RequestVote',
 'AppendEntries',
 'InstallSnapshot',
 'HeartbeatSync',
 'B', 2.50, 3),
(4, 1, 'What write anomaly is explicitly prevented by Snapshot Isolation (SI)?',
 'Dirty Reads and Lost Updates',
 'Write Skew Anomalies',
 'Read Skew Anomalies',
 'Cascading Aborts',
 'A', 2.50, 4);

-- Seed Questions for Exam 2 (Draft, 2 questions)
INSERT INTO Questions (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index) VALUES
(5, 2, 'Which mathematical problem forms the hardness assumption for classic RSA public key encryption?',
 'Discrete Logarithm Problem',
 'Integer Prime Factorization',
 'Shortest Vector Problem',
 'Elliptic Curve Point Addition',
 'B', 3.00, 1),
(6, 2, 'What property of a Zero-Knowledge Proof ensures the verifier learns nothing beyond the validity of the statement?',
 'Completeness',
 'Soundness',
 'Zero-Knowledge',
 'Succinctness',
 'C', 3.00, 2);

-- Seed Exam Sessions for Exam 1
INSERT INTO Exam_Sessions (id, exam_id, student_id, trust_score, status, started_at, server_deadline, last_heartbeat_at, ip_address, device_fingerprint, session_token, extra_minutes_granted) VALUES
(1, 1, 4, 100, 'IN_PROGRESS', NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE), NOW(), '127.0.0.1', 'test-fp-student-1', 'test-session-tok-student-1', 0),
(2, 1, 5, 88, 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW(), '127.0.0.1', 'test-fp-student-2', 'test-session-tok-student-2', 0);

-- Seed Responses for Session 2
INSERT INTO Student_Responses (session_id, question_id, selected_option, answered_at) VALUES
(2, 1, 'A', DATE_SUB(NOW(), INTERVAL 110 MINUTE)),
(2, 2, 'D', DATE_SUB(NOW(), INTERVAL 100 MINUTE)),
(2, 3, 'B', DATE_SUB(NOW(), INTERVAL 90 MINUTE)),
(2, 4, 'B', DATE_SUB(NOW(), INTERVAL 80 MINUTE));

-- Seed a sample proctoring log for Session 2 referencing violation_type_id = 1 (TAB_SWITCH)
INSERT INTO Proctoring_Logs (id, session_id, violation_type_id, occurred_at, evidence_meta, proctor_review_status) VALUES
(1, 2, 1, NOW(), JSON_OBJECT('sensor', 'test_fixture'), 'PENDING');

-- Grade Session 2 via stored procedure
CALL sp_SubmitAndGradeExam(2, 'STUDENT_SUBMIT');
