# ProctorIQ DBMS Verification Guide

Run these SQL checks directly against MySQL 8.0+ after initializing `/db/schema.sql` and `/db/seed.sql` to verify every database-enforced rule.

## 1. Verify Schema Objects Exist

```sql
USE proctoriq;
SHOW TRIGGERS;
SHOW PROCEDURE STATUS WHERE Db = 'proctoriq';
SHOW FULL TABLES WHERE Table_type = 'VIEW';
```

Expected:
- **5 Triggers**: `trg_before_violation_insert`, `trg_after_violation_insert`, `trg_after_violation_review_update`, `trg_before_response_insert`, `trg_before_response_update`
- **2 Procedures**: `sp_StartExamSession`, `sp_SubmitAndGradeExam`
- **2 Views**: `vw_ProctorLiveMonitor`, `vw_ViolationAuditReport`

## 2. Verify Trigger Penalty Deduction & Auto-Termination

```sql
-- Start session for student_id=3 on exam_id=1 (min_trust_score=50)
CALL sp_StartExamSession(1, 3);
-- Assume returned session id = @sid; log DEVTOOLS_OPEN (id=6, penalty=50) -> trust=50 (still IN_PROGRESS)
INSERT INTO Proctoring_Logs (session_id, violation_type_id) VALUES (@sid, 6);
SELECT id, trust_score, status FROM Exam_Sessions WHERE id = @sid;
-- Log COPY_PASTE (id=3, penalty=10) -> trust=40 < 50 -> status='TERMINATED_CHEATING'
INSERT INTO Proctoring_Logs (session_id, violation_type_id) VALUES (@sid, 3);
SELECT id, trust_score, status, ended_at FROM Exam_Sessions WHERE id = @sid;
```

## 3. Verify Trigger Blocks Writes on Closed Sessions

```sql
-- Attempting to save an answer after termination must fail with SQLSTATE 45000
INSERT INTO Student_Responses (session_id, question_id, selected_option) VALUES (@sid, 1, 'B');
```

## 4. Verify Idempotent Transactional Grading

```sql
CALL sp_SubmitAndGradeExam(@sid, 'STUDENT_SUBMIT');
-- Calling a second time returns the existing Results row without duplicate key error
CALL sp_SubmitAndGradeExam(@sid, 'STUDENT_SUBMIT');
SELECT * FROM Results WHERE session_id = @sid;
```

## 5. Verify Views

```sql
SELECT * FROM vw_ProctorLiveMonitor;
SELECT * FROM vw_ViolationAuditReport;
```

