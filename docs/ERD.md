# ProctorIQ Database Entity-Relationship & Integrity Design

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    USERS {
        int_unsigned id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        enum role "ADMIN | PROCTOR | STUDENT"
        boolean is_active
        timestamp created_at
    }

    EXAMS {
        int_unsigned id PK
        varchar title
        text description
        int_unsigned duration_minutes
        tinyint_unsigned min_trust_score "0..100"
        datetime start_window
        datetime end_window
        boolean is_published
        int_unsigned created_by FK
    }

    QUESTIONS {
        int_unsigned id PK
        int_unsigned exam_id FK
        text question_text
        varchar option_a
        varchar option_b
        varchar option_c
        varchar option_d
        enum correct_option "A | B | C | D"
        decimal marks
        int_unsigned order_index
    }

    EXAM_SESSIONS {
        int_unsigned id PK
        int_unsigned exam_id FK
        int_unsigned student_id FK
        tinyint_unsigned trust_score "DEFAULT 100"
        enum status "IN_PROGRESS | SUBMITTED | TERMINATED_CHEATING | TIMED_OUT"
        boolean needs_reinstatement "DEFAULT FALSE"
        datetime started_at
        datetime server_deadline
        datetime ended_at
        datetime last_heartbeat_at
    }

    STUDENT_RESPONSES {
        int_unsigned id PK
        int_unsigned session_id FK
        int_unsigned question_id FK
        enum selected_option "A | B | C | D"
        timestamp answered_at
    }

    VIOLATION_TYPES {
        tinyint_unsigned id PK
        varchar code UK
        varchar label
        tinyint_unsigned penalty_points
        enum severity "LOW | MEDIUM | HIGH | CRITICAL"
    }

    PROCTORING_LOGS {
        bigint_unsigned id PK
        int_unsigned session_id FK
        tinyint_unsigned violation_type_id FK
        tinyint_unsigned penalty_applied
        datetime occurred_at
        json evidence_meta
        enum proctor_review_status "PENDING | CONFIRMED | DISMISSED"
        int_unsigned reviewed_by FK
        datetime reviewed_at
        varchar review_notes
    }

    RESULTS {
        int_unsigned id PK
        int_unsigned session_id FK, UK
        decimal raw_score
        decimal total_marks
        decimal percentage
        tinyint_unsigned final_trust_score
        enum integrity_status "CLEAN | FLAGGED | DISQUALIFIED"
        datetime graded_at
    }

    USERS ||--o{ EXAMS : "creates (created_by)"
    USERS ||--o{ EXAM_SESSIONS : "attempts (student_id)"
    USERS ||--o{ PROCTORING_LOGS : "reviews (reviewed_by)"
    EXAMS ||--o{ QUESTIONS : "contains"
    EXAMS ||--o{ EXAM_SESSIONS : "hosts"
    EXAM_SESSIONS ||--o{ STUDENT_RESPONSES : "records"
    QUESTIONS ||--o{ STUDENT_RESPONSES : "answered_in"
    EXAM_SESSIONS ||--o{ PROCTORING_LOGS : "emits"
    VIOLATION_TYPES ||--o{ PROCTORING_LOGS : "classifies"
    EXAM_SESSIONS ||--o| RESULTS : "produces"
```

---

## 2. Third Normal Form (3NF) Justification

1. **1NF (Atomic Values & Keys)**: Every table has an explicit `PRIMARY KEY`, atomic scalar columns (with `evidence_meta` storing unstructured sensor payload metadata cleanly as JSON), and no repeating groups (`Questions` are normalized out of `Exams`, and `Student_Responses` are normalized out of `Exam_Sessions`).
2. **2NF (No Partial Dependencies)**: All composite business keys—`UNIQUE(exam_id, student_id)` on `Exam_Sessions` and `UNIQUE(session_id, question_id)` on `Student_Responses`—are mapped to surrogate `id` PKs with every non-key attribute depending on the full entity key (e.g. `selected_option` depends on both `session_id` and `question_id`).
3. **3NF (No Transitive Dependencies)**:
   - Violation definitions (`code`, `label`, `penalty_points`, `severity`) are isolated in `Violation_Types` rather than duplicated inside `Proctoring_Logs`. (`penalty_applied` is intentionally snapshotted at insert time so historical penalties remain auditable if catalog weights ever change.)
   - Exam thresholds (`min_trust_score`, `duration_minutes`) live exclusively on `Exams`, not duplicated in `Exam_Sessions`.
   - User identities (`full_name`, `email`, `role`) live solely on `Users`, referenced by `student_id`, `created_by`, and `reviewed_by`.

---

## 3. Trigger Execution Flow

```text
INSERT INTO Proctoring_Logs (session_id, violation_type_id, ...)
  │
  ▼ [trg_before_violation_insert]
  ├─ Verify Exam_Sessions.status = 'IN_PROGRESS' (else SIGNAL 45000)
  └─ Lookup Violation_Types.penalty_points → lock NEW.penalty_applied
  │
  ▼ [trg_after_violation_insert]
  ├─ Compute new_trust = GREATEST(0, trust_score - NEW.penalty_applied)
  ├─ IF new_trust < Exams.min_trust_score:
  │     UPDATE Exam_Sessions SET trust_score = new_trust, status = 'TERMINATED_CHEATING', ended_at = NOW()
  └─ ELSE:
        UPDATE Exam_Sessions SET trust_score = new_trust

UPDATE Proctoring_Logs SET proctor_review_status = 'DISMISSED' ...
  │
  ▼ [trg_before_log_update]
  └─ Reject mutations to forensic columns (id, session_id, violation_type_id, penalty_applied, occurred_at, evidence_meta)
  │
  ▼ [trg_after_review_update]
  ├─ On PENDING/CONFIRMED → DISMISSED: add penalty_points back (capped at 100)
  └─ IF status = 'TERMINATED_CHEATING' AND old_trust < min_trust AND restored_trust >= min_trust:
        Set Exam_Sessions.needs_reinstatement = TRUE (never silently reopens exam)

DELETE FROM Proctoring_Logs
  │
  ▼ [trg_before_log_delete]
  └─ Always raises SIGNAL SQLSTATE '45000' (append-only audit immutability)
```

---

## 4. `SELECT ... FOR UPDATE` Locking Strategy

In `sp_SubmitAndGradeExam(p_session_id, p_trigger_source)` and `sp_StartExamSession(p_exam_id, p_student_id)`:
1. **Race-Condition Prevention**: If a student clicks Submit at the exact millisecond a heartbeat timeout or violation auto-termination runs, two concurrent transactions could attempt to grade the same session simultaneously and insert duplicate `Results` rows.
2. **Pessimistic Row Lock**: `sp_SubmitAndGradeExam` executes `START TRANSACTION` and immediately acquires an exclusive InnoDB row lock via:
   ```sql
   SELECT es.exam_id, es.trust_score, es.status, es.server_deadline, e.min_trust_score
     FROM Exam_Sessions es
     JOIN Exams e ON e.id = es.exam_id
    WHERE es.id = p_session_id
    FOR UPDATE;
   ```
3. **Deterministic Serialization & Idempotency**: The second concurrent caller blocks at `FOR UPDATE` until the first transaction commits. Once unblocked, the second caller checks `Results` (`FOR UPDATE`), sees the newly committed `Results` row, and returns it cleanly without double-grading or throwing a duplicate key error.

