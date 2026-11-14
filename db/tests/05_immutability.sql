-- ============================================================================
-- Test Suite 05: Proctoring_Logs Immutability & Audit Guarantee
-- Tests that DELETE on Proctoring_Logs fails with SQLSTATE 45000.
-- ============================================================================

-- 1. Attempt DELETE on an existing Proctoring_Logs record
-- Expected: ERROR 1644 (45000): Proctoring_Logs is immutable: violation records cannot be deleted.
DELETE FROM Proctoring_Logs WHERE id = 1;

-- 2. Verify that log row was NOT deleted and count remains intact
SELECT id, session_id, violation_type_id, occurred_at, proctor_review_status
  FROM Proctoring_Logs
 WHERE id = 1;

