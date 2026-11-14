-- ============================================================================
-- ProctorIQ Migration 005: Performance Indexes
-- Sub-Phase 11.8 Performance Optimization
-- ============================================================================

USE proctoriq;

-- 1. Index on Results(graded_at) to accelerate administrative result feeds
-- Avoids filesort on GET /api/admin/results
CREATE INDEX idx_results_graded_at ON Results (graded_at DESC);

-- 2. Composite index on Exam_Sessions(status, server_deadline)
-- Accelerates sp_AutoTimeoutExpiredSessions and deadline monitoring queries
CREATE INDEX idx_sessions_status_deadline ON Exam_Sessions (status, server_deadline);

