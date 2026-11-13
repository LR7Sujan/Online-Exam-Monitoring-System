-- ============================================================================
-- ProctorIQ Migration 003: Session IP, Device Fingerprint & Session Token
-- ============================================================================

USE proctoriq;

ALTER TABLE Exam_Sessions
  ADD COLUMN ip_address VARCHAR(64) NULL AFTER needs_reinstatement,
  ADD COLUMN device_fingerprint VARCHAR(255) NULL AFTER ip_address,
  ADD COLUMN session_token VARCHAR(128) NULL AFTER device_fingerprint;

CREATE INDEX idx_sessions_token ON Exam_Sessions (session_token);

CREATE OR REPLACE VIEW vw_ProctorLiveMonitor AS
SELECT
  es.id AS session_id,
  es.exam_id,
  e.title AS exam_title,
  e.min_trust_score,
  e.duration_minutes,
  es.student_id,
  u.full_name AS student_name,
  u.email AS student_email,
  es.trust_score,
  es.status,
  es.needs_reinstatement,
  es.ip_address,
  es.device_fingerprint,
  es.started_at,
  es.server_deadline,
  es.ended_at,
  es.last_heartbeat_at,
  GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
  COALESCE(pl_agg.total_violations, 0) AS total_violations,
  COALESCE(pl_agg.pending_violations, 0) AS pending_violations,
  COALESCE(pl_agg.confirmed_violations, 0) AS confirmed_violations,
  COALESCE(pl_agg.dismissed_violations, 0) AS dismissed_violations,
  pl_agg.last_violation_at,
  r.raw_score,
  r.total_marks,
  r.percentage,
  r.integrity_status
FROM Exam_Sessions es
JOIN Exams e ON e.id = es.exam_id
JOIN Users u ON u.id = es.student_id
LEFT JOIN (
  SELECT
    session_id,
    COUNT(*) AS total_violations,
    SUM(CASE WHEN proctor_review_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_violations,
    SUM(CASE WHEN proctor_review_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_violations,
    SUM(CASE WHEN proctor_review_status = 'DISMISSED' THEN 1 ELSE 0 END) AS dismissed_violations,
    MAX(occurred_at) AS last_violation_at
  FROM Proctoring_Logs
  GROUP BY session_id
) pl_agg ON pl_agg.session_id = es.id
LEFT JOIN Results r ON r.session_id = es.id;

