import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, pool, queryRows } from '../config/db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitSessionTerminated, emitViolationNew } from '../realtime/index.js';
import { shouldDebounceViolation, violationRateLimiter } from '../services/violationGuard.js';
import type { ExamSessionRow, ViolationTypeRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { saveSnapshotImage } from './sessions.routes.js';

export const violationsRouter = Router();

const reportViolationSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  violationCode: z.string().trim().min(2).max(40),
  evidenceMeta: z.record(z.unknown()).optional(),
  snapshot: z.string().optional().nullable(),
});

// GET /api/violations/types
violationsRouter.get('/types', requireAuth, async (_req, res, next) => {
  try {
    const types = await queryRows<ViolationTypeRow[]>(
      'SELECT id, code, label, description, penalty_points, severity FROM Violation_Types ORDER BY penalty_points ASC'
    );
    sendSuccess(res, types);
  } catch (err) {
    next(err);
  }
});

// QA Fix (Sub-Phase 11.3): Support both POST /api/violations and POST /api/violations/report
const handleViolationReport = async (req: AuthenticatedRequest, res: Parameters<typeof sendSuccess>[0], next: (e?: unknown) => void) => {
  try {
    const { sessionId, violationCode, evidenceMeta } = req.body as z.infer<
      typeof reportViolationSchema
    >;
    const code = violationCode.toUpperCase();

    const sessionRows = await queryRows<ExamSessionRow[]>(
      `SELECT es.*, e.min_trust_score, e.title AS exam_title
         FROM Exam_Sessions es
         JOIN Exams e ON e.id = es.exam_id
        WHERE es.id = ?
        LIMIT 1`,
      [sessionId]
    );
    const session = sessionRows[0];
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
    }
    if (session.student_id !== req.user!.sub) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot report violation for another student session.');
    }

    const typeRows = await queryRows<ViolationTypeRow[]>(
      'SELECT id, code, label, penalty_points, severity FROM Violation_Types WHERE code = ? LIMIT 1',
      [code]
    );
    const vType = typeRows[0];
    if (!vType) {
      throw new AppError(400, 'INVALID_VIOLATION_CODE', 'Unknown violation code.');
    }

    // QA Security Fix (Sub-Phase 11.4): Validate snapshot image format and file size before debounce check
    const rawSnapshot = req.body.snapshot || (evidenceMeta?.snapshot as string | undefined);
    const savedSnapshotUrl = await saveSnapshotImage(sessionId, rawSnapshot);

    if (shouldDebounceViolation(sessionId, code)) {
      sendSuccess(res, {
        debounced: true,
        violationCode: code,
        trustScore: session.trust_score,
        trust_score: session.trust_score,
        minTrustScore: session.min_trust_score,
        status: session.status,
      });
      return;
    }

    const insertRes = await executeSql(
      `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta, snapshot_url)
       VALUES (?, ?, ?, ?)`,
      [sessionId, vType.id, evidenceMeta ? JSON.stringify(evidenceMeta) : null, savedSnapshotUrl]
    );

    const updatedRows = await queryRows<ExamSessionRow[]>(
      `SELECT es.*, e.min_trust_score, e.title AS exam_title
         FROM Exam_Sessions es
         JOIN Exams e ON e.id = es.exam_id
        WHERE es.id = ?
        LIMIT 1`,
      [sessionId]
    );
    const updatedSession = updatedRows[0];

    const payload = {
      logId: insertRes.insertId,
      sessionId,
      examId: updatedSession.exam_id,
      studentId: updatedSession.student_id,
      studentName: req.user!.fullName,
      violationCode: vType.code,
      violationLabel: vType.label,
      severity: vType.severity,
      penaltyApplied: vType.penalty_points,
      trustScore: updatedSession.trust_score,
      trust_score: updatedSession.trust_score,
      minTrustScore: updatedSession.min_trust_score,
      sessionStatus: updatedSession.status,
      status: updatedSession.status,
      occurredAt: new Date().toISOString(),
    };

    emitViolationNew(updatedSession.student_id, sessionId, payload, {
      sessionId,
      trust_score: updatedSession.trust_score,
      status: updatedSession.status,
    });

    let gradedResult = null;
    if (updatedSession.status === 'TERMINATED_CHEATING') {
      const [resultSets] = await pool.query<RowDataPacket[][]>(
        'CALL sp_SubmitAndGradeExam(?, ?)',
        [sessionId, 'AUTO_TERMINATED']
      );
      gradedResult = resultSets[0]?.[0] ?? null;

      emitSessionTerminated(
        updatedSession.student_id,
        sessionId,
        { ...payload, reason: vType.code, result: gradedResult },
        {
          sessionId,
          trust_score: updatedSession.trust_score,
          status: updatedSession.status,
          reason: vType.code,
        }
      );
    }

    sendSuccess(
      res,
      {
        logId: insertRes.insertId,
        violationCode: vType.code,
        penaltyApplied: vType.penalty_points,
        trustScore: updatedSession.trust_score,
        trust_score: updatedSession.trust_score,
        minTrustScore: updatedSession.min_trust_score,
        status: updatedSession.status,
        debounced: false,
        result: gradedResult,
      },
      200
    );
  } catch (err) {
    next(err);
  }
};

violationsRouter.post(
  '/',
  requireAuth,
  requireRole('STUDENT'),
  violationRateLimiter,
  validate({ body: reportViolationSchema }),
  handleViolationReport
);

violationsRouter.post(
  '/report',
  requireAuth,
  requireRole('STUDENT'),
  violationRateLimiter,
  validate({ body: reportViolationSchema }),
  handleViolationReport
);
