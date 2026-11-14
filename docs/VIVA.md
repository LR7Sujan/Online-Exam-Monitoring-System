# ProctorIQ — Comprehensive Viva & Defense Guide

This guide breaks down the core database architecture, transaction semantics, forensic integrity design, and concurrency controls of **ProctorIQ** into clear, authoritative, and plain-English answers for academic defense and technical interviews.

---

## Part 1: Core Architectural Questions

### 1. Why is `Violation_Types` separate from `Proctoring_Logs`?
**In simple words:**
Third Normal Form (3NF) and instant, zero-downtime policy changes.

- **Normalization (3NF):** A log entry in `Proctoring_Logs` represents a specific historical event at a timestamp. If we stored the violation description, category, and default penalty weight directly inside `Proctoring_Logs`, modifying a penalty rule would require running an `UPDATE` on millions of historical log rows.
- **Single-Row Agility:** By separating `Violation_Types` into its own reference table, an administrator can change the penalty for `TAB_SWITCH` from 15 points to 25 points with a single atomic `UPDATE Violation_Types SET default_penalty = 25 WHERE code = 'TAB_SWITCH'`. The next violation reported immediately pulls the new weight with zero code changes or redeployments.
- **Audit Immutability:** Historical entries in `Proctoring_Logs` preserve the exact `penalty_applied` that was in effect at the moment the infraction took place, maintaining forensic integrity even if rules change in the future.

---

### 2. Why use a Database Trigger instead of Backend Application Checks for Thresholds?
**In simple words:**
Guaranteed atomic enforcement with zero race conditions, regardless of where the violation comes from.

- **Eliminating Application Race Conditions:** If threshold checking lived in the Node.js backend (`if (score < 50) terminate()`), two concurrent violation events (for example, a simultaneous tab switch and an optical face-loss detection) handled by different threads or API workers could both read a score of 55, subtract 10 independently, and fail to trigger termination promptly due to a race window.
- **Source-Agnostic Defense:** A MySQL `AFTER INSERT` trigger (`trg_after_violation_insert`) executes synchronously inside the database transaction engine. Even if an admin runs a direct SQL script, an external microservice inserts a violation, or multiple Node instances process requests simultaneously, the database *itself* enforces the minimum trust score invariant and automatically updates the session status to `TERMINATED_CHEATING`.

---

### 3. How does `SELECT ... FOR UPDATE` prevent duplicate results during simultaneous auto-submit and manual submit?
**In simple words:**
It places an exclusive, pessimistic row lock on the session record so only one grading transaction can execute.

- **The Scenario:** Suppose a student clicks "Submit Exam" at the exact millisecond the exam timer expires and an automated background worker triggers auto-submit.
- **The Mechanism:** When stored procedure `sp_SubmitAndGradeExam` executes, the very first SQL statement inside the transaction is:
  ```sql
  SELECT status INTO v_current_status
  FROM Exam_Sessions
  WHERE id = p_session_id
  FOR UPDATE;
  ```
- **The Guarantee:** `FOR UPDATE` instructs InnoDB to place an exclusive write lock on that row. The second transaction attempting to read or submit is blocked until the first transaction finishes. Once the first transaction completes, the session status is set to `COMPLETED` (or `TERMINATED_CHEATING`). When the second transaction acquires the lock, it immediately checks `IF v_current_status != 'IN_PROGRESS'` and exits with an error or no-op. Only **one** row is ever inserted into the `Results` table.

---

### 4. Why are `UNIQUE(exam_id, student_id)` and UPSERT (`ON DUPLICATE KEY UPDATE`) used?
**In simple words:**
To guarantee one attempt per student and allow seamless answer autosaves without primary key collisions.

- **One Exam Attempt Per Student:** On `Exam_Sessions`, the constraint `UNIQUE KEY uq_exam_student (exam_id, student_id)` guarantees at the relational engine level that a student can never start two concurrent sessions for the same examination, preventing multi-browser cheating attempts.
- **Answer Autosave (UPSERT):** On `Student_Responses`, the composite unique index is `UNIQUE KEY uq_session_question (session_id, question_id)`. When a student clicks an answer or changes their mind from option B to option C, the frontend sends an UPSERT:
  ```sql
  INSERT INTO Student_Responses (session_id, question_id, selected_option, answered_at)
  VALUES (?, ?, ?, NOW())
  ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option), answered_at = NOW();
  ```
  This creates the row if it's the first time they answer, or updates the existing row in-place if they change their answer—all in a single atomic query with zero duplicate records.

---

### 5. How does the audit log stay immutable?
**In simple words:**
Database triggers reject all `DELETE` operations and unauthorized `UPDATE` attempts with `SQLSTATE 45000`.

- **Preventing Log Erasure:** The trigger `trg_before_log_delete` intercepts any attempt to delete a record from `Proctoring_Logs`:
  ```sql
  CREATE TRIGGER trg_before_log_delete
  BEFORE DELETE ON Proctoring_Logs
  FOR EACH ROW
  BEGIN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'PROCTORIQ_IMMUTABLE_LOG: Deletion of proctoring telemetry is strictly prohibited.';
  END;
  ```
- **Preventing Forensic Tampering:** The trigger `trg_before_log_update` ensures that fields like `session_id`, `violation_type_id`, `penalty_applied`, and `occurred_at` can never be edited after creation. Only authorized adjudication updates (changing `proctor_review_status` from `PENDING` to `CONFIRMED` or `DISMISSED`) are permitted.

---

### 6. What are the database indexes for and why were they chosen?
**In simple words:**
They prevent slow table scans and ensure sub-millisecond query execution under heavy live examination load.

1. **`idx_logs_session_occurred (session_id, occurred_at)` on `Proctoring_Logs`:**
   - Powers the real-time proctor timeline drawer and student result audit trail (`WHERE session_id = ? ORDER BY occurred_at DESC`). Avoids scanning millions of logs from other exams.
2. **`idx_logs_review_occurred (proctor_review_status, occurred_at)` on `Proctoring_Logs`:**
   - Accelerates the Proctor Adjudication Queue (`WHERE proctor_review_status = 'PENDING' ORDER BY occurred_at DESC`). Enables instant filtering of unreviewed infractions without scanning resolved logs.
3. **`uq_exam_student (exam_id, student_id)` on `Exam_Sessions`:**
   - Enforces unique enrollment attempts and provides instantaneous index-lookup for `sp_StartExamSession` to check if a student already has an active session.
4. **`idx_sessions_status_deadline (status, server_deadline)` on `Exam_Sessions`:**
   - Used by the server-side cron engine to auto-close and grade expired sessions (`WHERE status = 'IN_PROGRESS' AND server_deadline < NOW()`).

---

## Part 2: 15 Core Defense & Viva Questions

### 7. What is ACID, and how does ProctorIQ enforce it?
- **Atomicity:** In `sp_SubmitAndGradeExam`, answer evaluation, percentage calculation, status assignment, session status update, and result insertion all succeed together or roll back completely via `START TRANSACTION` and `ROLLBACK`.
- **Consistency:** Triggers reject invalid operations (e.g. inserting an answer after `server_deadline` or applying a violation to a closed exam) using `SIGNAL SQLSTATE '45000'`.
- **Isolation:** InnoDB's default isolation level (`REPEATABLE READ`) combined with `SELECT ... FOR UPDATE` prevents dirty reads, non-repeatable reads, and phantom writes.
- **Durability:** Committed transactions are written to InnoDB's Write-Ahead Log (WAL / redo log) and flushed to disk.

---

### 8. Why use Stored Procedures (`sp_SubmitAndGradeExam`) instead of grading in Node.js?
1. **Network Efficiency:** Grading 100 questions in Node.js requires fetching all student answers, correct answer keys, and point values across the network. A stored procedure grades everything in-memory on the database server using a single `JOIN` query.
2. **Security:** Correct answer keys never need to be exposed to application servers or transmitted across API endpoints, eliminating memory-scraping vulnerabilities.
3. **Atomic Finality:** Grading and session closure happen inside an isolated database transaction, ensuring no partial grades can exist if an application process crashes mid-evaluation.

---

### 9. What happens if a Proctor dismisses a violation? How are points restored?
- When a proctor reviews a flagged incident in the Adjudication Queue and clicks "Dismiss", the backend executes:
  ```sql
  UPDATE Proctoring_Logs
  SET proctor_review_status = 'DISMISSED',
      reviewed_by = ?,
      reviewed_at = NOW()
  WHERE id = ?;
  ```
- The trigger `trg_after_review_update` fires automatically:
  - It adds `penalty_applied` back to `Exam_Sessions.trust_score` (capped at 100).
  - If a `Results` record already exists, it updates `final_trust_score` and recalculates `integrity_status` (e.g. from `FLAGGED` back to `CLEAN`).
  - The proctor UI listens on Socket.IO and immediately animates the student's TrustRing score back up in real time.

---

### 10. How does the database guarantee students cannot submit answers after the deadline?
- In `Exam_Sessions`, `server_deadline` is set at session start:
  ```sql
  LEAST(end_window, NOW() + INTERVAL duration_minutes MINUTE)
  ```
- Before any answer is inserted or updated in `Student_Responses`, trigger `trg_before_response_insert` executes:
  ```sql
  IF NOW() > (SELECT server_deadline FROM Exam_Sessions WHERE id = NEW.session_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'DEADLINE_EXPIRED: Cannot record response after server deadline.';
  END IF;
  ```
- Client clock manipulation (e.g., rolling back the OS time on a student laptop) has zero effect because time validation occurs entirely on the authoritative database server clock (`NOW()`).

---

### 11. Why is `server_deadline` calculated as `LEAST(end_window, NOW() + duration)`?
- If an exam has a 60-minute duration but the institutional test window closes in 20 minutes, a student starting late should only receive 20 minutes, not 60.
- `LEAST(end_window, NOW() + INTERVAL duration_minutes MINUTE)` mathematically clamps the candidate's deadline to whichever boundary comes first, preventing unauthorized overtime.

---

### 12. Why do we hash passwords with `bcrypt` instead of storing plain text or using SHA-256?
- **Salting:** `bcrypt` generates a cryptographically random salt for each password, rendering precomputed rainbow tables useless.
- **Adaptive Work Factor (Cost Factor):** `bcrypt` is computationally expensive by design (we use 10 rounds). It takes ~100ms per attempt, making offline brute-force and dictionary attacks computationally infeasible, unlike fast cryptographic hashes like SHA-256 or MD5 which can test billions of hashes per second on GPUs.

---

### 13. How does ProctorIQ prevent SQL Injection vulnerabilities?
- **Zero String Concatenation:** All SQL statements in the server layer use parameterized prepared statements (`?` placeholders via `mysql2/promise`):
  ```typescript
  await executeSql('SELECT * FROM Users WHERE email = ?', [email]);
  ```
- In prepared statements, the database engine compiles the SQL query structure first, and then treats user inputs strictly as typed data literals, making it impossible for input strings like `' OR '1'='1` to alter query logic.

---

### 14. What is the difference between `BEFORE INSERT` and `AFTER INSERT` triggers in ProctorIQ?
- **`BEFORE INSERT` (`trg_before_violation_insert`):**
  - Runs *before* the row is written to disk.
  - Used for **validation and mutation**: It checks if the session is still `IN_PROGRESS` (rejects with `45000` if closed) and automatically sets `NEW.penalty_applied` from `Violation_Types.default_penalty`.
- **`AFTER INSERT` (`trg_after_violation_insert`):**
  - Runs *after* the row is successfully recorded.
  - Used for **cross-table side-effects**: It deducts points from `Exam_Sessions.trust_score` and triggers auto-termination (`TERMINATED_CHEATING`) if the score breaches `min_trust_score`.

---

### 15. What are Database Views, and why are `vw_ProctorLiveMonitor` and `vw_ViolationAuditReport` used?
- **Definition:** A view is a stored virtual query that can be queried like a table.
- **Security & Simplicity:** It encapsulates complex multi-table joins, aggregations, and calculations into a single clean projection.
- **Performance:** `vw_ProctorLiveMonitor` pre-joins `Exam_Sessions`, `Users`, `Exams`, and aggregated violation counts, allowing the proctor dashboard to fetch complete telemetry in a single lightweight query rather than executing 5 separate queries per student tile.

---

### 16. How does the frontend prevent rapid false positives from dropping trust scores instantly?
- **3-Second Client Debounce:** The proctoring engine (`useProctoring` hook and server-side debounce map) enforces a 3-second debounce window per violation code. If a student's webcam flickers for 200ms twice in 2 seconds, only one violation is sent.
- **Consecutive Detection Rules:** Client-side optical face detection requires **0 faces for 5 continuous seconds** before issuing a `NO_FACE` violation, preventing brief head-turning or blinking from penalizing the candidate.

---

### 17. What is an UPSERT, and how does it prevent concurrency errors?
- UPSERT stands for "UPDATE or INSERT".
- Standard `SELECT`-then-`INSERT` patterns suffer from race conditions: two threads can both check if an answer exists, find none, and both attempt an `INSERT`, causing duplicate key errors.
- `INSERT ... ON DUPLICATE KEY UPDATE` is atomic in MySQL: the database engine attempts insertion; if the unique constraint is hit, it seamlessly executes the update branch in the same engine step without raising exceptions.

---

### 18. What transaction isolation level is used by MySQL InnoDB, and why does it matter?
- ProctorIQ uses InnoDB's default **`REPEATABLE READ`**.
- It guarantees that any row read within a transaction remains identical across multiple reads, preventing "non-repeatable reads".
- Paired with `SELECT ... FOR UPDATE`, it ensures consistent snapshot reads during grading while explicitly locking the target session to prevent concurrent writes.

---

### 19. How does Socket.IO integrate with the MySQL database without creating bottlenecks?
- **Decoupled Architecture:** Socket.IO does not poll the database. Instead, when an API route successfully commits a database transaction (e.g. reporting a violation or dismissing an incident), it broadcasts an event to the authenticated room (e.g. `role:PROCTOR` or `session:<id>`).
- **Low Latency:** Live updates reach proctor dashboards in under 15ms without imposing extra read queries on the MySQL connection pool.

---

### 20. Why are violation snapshot images stored on the filesystem instead of as BLOBs in MySQL?
1. **Database Sizing & Performance:** High-resolution JPEG images range from 100KB to 2MB. Storing millions of images as `LONGBLOB` in MySQL inflates database tablespaces, exhausts buffer pools, slows backups, and degrades query cache efficiency.
2. **High-Performance Static Delivery:** Storing images on disk (`server/uploads`) allows Node.js / Nginx to serve them via streaming file descriptors with HTTP caching headers, while the database only stores lightweight string paths (`snapshot_url`).
3. **Forensic Security:** Access to the static `/uploads` route is protected behind JWT authentication middleware, preventing unauthorized public access.

---

### 21. What are the known limitations of browser-based proctoring, and how should institutions use ProctorIQ?
- **Client-Side Boundaries:** Any web-app proctoring system running inside standard consumer browsers (Chrome, Edge, Firefox) is constrained by browser security sandboxes. Advanced users can technically use hardware capture cards, virtual machines, secondary monitors, or specialized browser proxies.
- **The ProctorIQ Approach:** ProctorIQ is designed as an **augmented detection and deterrent engine** with an immutable database audit trail. For high-stakes certification examinations, it is recommended to pair ProctorIQ with dedicated OS lockdown browsers (such as Safe Exam Browser) and secondary mobile camera feeds.

