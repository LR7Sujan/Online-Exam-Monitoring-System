-- ============================================================================
-- Test Suite 08: Analytic Views Verification
-- Compares view row counts and aggregations against manual queries on base tables.
-- ============================================================================

-- 1. vw_ProctorLiveMonitor vs Exam_Sessions
SELECT
  (SELECT COUNT(*) FROM vw_ProctorLiveMonitor) AS view_count,
  (SELECT COUNT(*) FROM Exam_Sessions) AS manual_count,
  IF((SELECT COUNT(*) FROM vw_ProctorLiveMonitor) = (SELECT COUNT(*) FROM Exam_Sessions), 'MATCH', 'MISMATCH') AS verdict;

-- 2. vw_ViolationAuditReport vs Proctoring_Logs
SELECT
  (SELECT COUNT(*) FROM vw_ViolationAuditReport) AS view_count,
  (SELECT COUNT(*) FROM Proctoring_Logs) AS manual_count,
  IF((SELECT COUNT(*) FROM vw_ViolationAuditReport) = (SELECT COUNT(*) FROM Proctoring_Logs), 'MATCH', 'MISMATCH') AS verdict;

-- 3. vw_ExamAnalytics vs Exams
SELECT
  (SELECT COUNT(*) FROM vw_ExamAnalytics) AS view_count,
  (SELECT COUNT(*) FROM Exams) AS manual_count,
  IF((SELECT COUNT(*) FROM vw_ExamAnalytics) = (SELECT COUNT(*) FROM Exams), 'MATCH', 'MISMATCH') AS verdict;

-- 4. vw_ViolationHeatmap Aggregation vs Proctoring_Logs
SELECT
  (SELECT COALESCE(SUM(violation_count), 0) FROM vw_ViolationHeatmap) AS heatmap_total_violations,
  (SELECT COUNT(*) FROM Proctoring_Logs) AS manual_total_violations,
  (SELECT COALESCE(SUM(total_penalty_points), 0) FROM vw_ViolationHeatmap) AS heatmap_total_penalties,
  (SELECT COALESCE(SUM(penalty_applied), 0) FROM Proctoring_Logs) AS manual_total_penalties,
  IF(
    (SELECT COALESCE(SUM(violation_count), 0) FROM vw_ViolationHeatmap) = (SELECT COUNT(*) FROM Proctoring_Logs)
    AND (SELECT COALESCE(SUM(total_penalty_points), 0) FROM vw_ViolationHeatmap) = (SELECT COALESCE(SUM(penalty_applied), 0) FROM Proctoring_Logs),
    'MATCH',
    'MISMATCH'
  ) AS verdict;

