-- Migration 004: Snapshot Support for Proctoring Violations

USE proctoriq;

DROP TRIGGER IF EXISTS trg_before_log_update;

DELIMITER $$

CREATE TRIGGER trg_before_log_update
BEFORE UPDATE ON Proctoring_Logs
FOR EACH ROW
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.session_id <> OLD.session_id
     OR NEW.violation_type_id <> OLD.violation_type_id
     OR NEW.penalty_applied <> OLD.penalty_applied
     OR NEW.occurred_at <> OLD.occurred_at
     OR NOT (NEW.evidence_meta <=> OLD.evidence_meta)
     OR NOT (NEW.snapshot_url <=> OLD.snapshot_url) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proctoring_Logs is immutable: forensic violation fields cannot be modified.';
  END IF;

  IF NEW.proctor_review_status = OLD.proctor_review_status
     AND (
       NOT (NEW.reviewed_by <=> OLD.reviewed_by)
       OR NOT (NEW.reviewed_at <=> OLD.reviewed_at)
       OR NOT (NEW.review_notes <=> OLD.review_notes)
     ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proctoring_Logs is immutable: only proctor_review_status transitions may be updated.';
  END IF;
END$$

DELIMITER ;

CREATE OR REPLACE VIEW vw_ViolationAuditReport AS
SELECT
  pl.id AS log_id,
  pl.session_id,
  es.exam_id,
  e.title AS exam_title,
  e.min_trust_score,
  es.student_id,
  stu.full_name AS student_name,
  stu.email AS student_email,
  vt.id AS violation_type_id,
  vt.code AS violation_code,
  vt.label AS violation_label,
  vt.severity,
  pl.penalty_applied,
  pl.occurred_at,
  pl.evidence_meta,
  pl.snapshot_url,
  pl.proctor_review_status,
  pl.reviewed_by,
  rev.full_name AS reviewer_name,
  pl.reviewed_at,
  pl.review_notes,
  es.trust_score AS current_trust_score,
  es.status AS session_status,
  r.integrity_status
FROM Proctoring_Logs pl
JOIN Violation_Types vt ON vt.id = pl.violation_type_id
JOIN Exam_Sessions es ON es.id = pl.session_id
JOIN Exams e ON e.id = es.exam_id
JOIN Users stu ON stu.id = es.student_id
LEFT JOIN Users rev ON rev.id = pl.reviewed_by
LEFT JOIN Results r ON r.session_id = es.id;

