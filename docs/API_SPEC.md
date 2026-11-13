# ProctorIQ REST & Socket.IO API Specification

All HTTP responses conform strictly to the envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DB_RULE_VIOLATION",
    "message": "Cannot log violation: exam session is no longer IN_PROGRESS."
  }
}
```

## REST Endpoints

### Health & Auth
- `GET /api/health` — Returns service & MySQL connection status.
- `POST /api/auth/register` — Registers a `STUDENT` account (`fullName`, `email`, `password`).
- `POST /api/auth/login` — Authenticates and issues JWT (`8h` default).
- `GET /api/auth/me` — Returns current authenticated user profile.

### Exams & Questions
- `GET /api/exams` — Students see published exams + own session status; Proctor/Admin see all exams.
- `GET /api/exams/:examId` — Exam detail (Admin/Proctor also receive `Questions` with `correct_option`).
- `POST /api/exams` *(ADMIN)* — Create exam.
- `PATCH /api/exams/:examId` *(ADMIN)* — Update or publish exam.
- `POST /api/exams/:examId/questions` *(ADMIN)* — Add MCQ question.
- `DELETE /api/exams/:examId/questions/:questionId` *(ADMIN)* — Delete MCQ question.

### Student Exam Sessions
- `POST /api/sessions/start` *(STUDENT)* — Calls `CALL sp_StartExamSession(examId, studentId)`.
- `GET /api/sessions/:sessionId` *(Owner / PROCTOR / ADMIN)* — Session state, sanitized questions (no `correct_option`), saved responses, and recent logs.
- `POST /api/sessions/:sessionId/heartbeat` *(STUDENT)* — Syncs server timer; auto-triggers `sp_SubmitAndGradeExam(id, 'TIMEOUT')` when `server_deadline` passes.
- `PUT /api/sessions/:sessionId/responses` *(STUDENT)* — Atomic `INSERT ... ON DUPLICATE KEY UPDATE` into `Student_Responses`.
- `POST /api/sessions/:sessionId/submit` *(STUDENT)* — Calls `CALL sp_SubmitAndGradeExam(sessionId, 'STUDENT_SUBMIT')`.
- `GET /api/sessions/:sessionId/result` *(Owner / PROCTOR / ADMIN)* — Graded `Results` + violation trail.

### Violations & Proctor Triage
- `GET /api/violations/types` *(Authenticated)* — Lists `Violation_Types` and authoritative penalty weights.
- `POST /api/violations/report` *(STUDENT)* — Inserts into `Proctoring_Logs`; MySQL triggers deduct penalty and auto-terminate below threshold.
- `GET /api/proctor/live-monitor` *(PROCTOR / ADMIN)* — Queries `vw_ProctorLiveMonitor`.
- `GET /api/proctor/audit-report` *(PROCTOR / ADMIN)* — Queries `vw_ViolationAuditReport`.
- `GET /api/proctor/sessions/:sessionId/inspect` *(PROCTOR / ADMIN)* — Full session + evidence inspection.
- `PATCH /api/proctor/logs/:logId/review` *(PROCTOR / ADMIN)* — Sets `CONFIRMED` or `DISMISSED`; trigger `trg_after_violation_review_update` adjusts trust score.
- `POST /api/proctor/sessions/:sessionId/terminate` *(PROCTOR / ADMIN)* — Manual disqualification + grading.

### Admin Telemetry
- `GET /api/admin/results` *(ADMIN)* — All graded `Results`.
- `GET /api/admin/users` *(ADMIN)* — Registered users (without password hashes).
- `GET /api/admin/db-telemetry` *(ADMIN)* — Live `information_schema` triggers, procedures, views, and InnoDB tables.

## Socket.IO Events (JWT Authenticated Handshake)

- Client emits: `session:join` (`sessionId`), `session:leave` (`sessionId`)
- Server emits to `proctors` and `session:<id>`:
  - `session:started`
  - `session:heartbeat`
  - `violation:logged`
  - `violation:reviewed`
  - `session:terminated`
  - `session:submitted`

