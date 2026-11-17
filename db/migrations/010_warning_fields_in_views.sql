-- ============================================================================
-- Migration 010: Add Warning Fields to vw_ProctorLiveMonitor
-- ============================================================================

CREATE OR REPLACE VIEW vw_ProctorLiveMonitor AS
SELECT
  es.id AS session_id,
  es.exam_id,
  e.title AS exam_title,
  e.min_trust_score,
  e.duration_minutes,
  e.max_extension_mins,
  es.student_id,
  u.full_name AS student_name,
  u.email AS student_email,
  es.trust_score,
  es.status,
  es.needs_reinstatement,
  es.extra_minutes_granted,
  es.ip_address,
  es.device_fingerprint,
  es.started_at,
  es.server_deadline,
  es.ended_at,
  es.last_heartbeat_at,
  es.time_expired_at,
  es.pending_warning_log_id,
  es.warning_count,
  es.last_warning_ack_at,
  CASE
    WHEN es.status = 'IN_PROGRESS'
     AND COALESCE(e.max_extension_mins, 0) > 0
     AND NOW() >= es.server_deadline
     AND NOW() <= DATE_ADD(es.server_deadline, INTERVAL 180 SECOND)
    THEN 1
    ELSE 0
  END AS in_grace_window,
  GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
  COALESCE(pl_agg.total_violations, 0) AS total_violations,
  COALESCE(pl_agg.pending_violations, 0) AS pending_violations,
  COALESCE(pl_agg.confirmed_violations, 0) AS confirmed_violations,
  COALESCE(pl_agg.dismissed_violations, 0) AS dismissed_violations,
  pl_agg.last_violation_at,
  r.raw_score,
  r.total_marks,
  r.percentage,
  r.integrity_status,
  ter.request_id AS extension_request_id,
  ter.status AS extension_status,
  ter.requested_minutes AS extension_requested_minutes,
  ter.granted_minutes AS extension_granted_minutes,
  ter.reason AS extension_reason,
  ter.created_at AS extension_created_at,
  ter.decided_at AS extension_decided_at,
  ter.decided_by AS extension_decided_by,
  decider.full_name AS extension_decided_by_name
FROM Exam_Sessions es
JOIN Exams e ON e.id = es.exam_id
JOIN Users u ON u.id = es.student_id
LEFT JOIN Results r ON r.session_id = es.id
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
LEFT JOIN (
  SELECT *
  FROM Time_Extension_Requests
  WHERE (session_id, request_id) IN (
    SELECT session_id, MAX(request_id)
    FROM Time_Extension_Requests
    GROUP BY session_id
  )
) ter ON ter.session_id = es.id
LEFT JOIN Users decider ON decider.id = ter.decided_by;
