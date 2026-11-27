-- ============================================================================
-- Migration 018: Performance Indexes and Query Optimizations
-- ============================================================================

-- 1. Optimize Exam_Sessions by (status, exam_id, student_id) for live monitor and student checks
ALTER TABLE Exam_Sessions
  ADD INDEX idx_sessions_status_exam_student (status, exam_id, student_id),
  ADD INDEX idx_sessions_exam_status (exam_id, status);

-- 2. Optimize Proctoring_Logs for audit ordering and covering review aggregation
ALTER TABLE Proctoring_Logs
  ADD INDEX idx_logs_occurred_id (occurred_at DESC, id DESC),
  ADD INDEX idx_logs_session_review_time (session_id, proctor_review_status, occurred_at);

-- 3. Optimize Results for session lookup with integrity status
ALTER TABLE Results
  ADD INDEX idx_results_session_integrity (session_id, integrity_status);

-- 4. Optimize Session_Warnings for session time ordering
ALTER TABLE Session_Warnings
  ADD INDEX idx_sw_session_time (session_id, warning_id);
