import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, pool, queryRows } from '../config/db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitSessionTerminated, emitSessionUpdate, emitToProctors, emitToStudent } from '../realtime/socket.js';
import type { ExamSessionRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const proctorRouter = Router();

proctorRouter.use(requireAuth, requireRole('PROCTOR', 'ADMIN'));

const liveMonitorQuerySchema = z.object({
  examId: z.coerce.number().int().positive().optional(),
  status: z
    .enum(['IN_PROGRESS', 'SUBMITTED', 'TERMINATED_CHEATING', 'TIMED_OUT'])
    .optional(),
});

const auditQuerySchema = z.object({
  examId: z.coerce.number().int().positive().optional(),
  sessionId: z.coerce.number().int().positive().optional(),
  reviewStatus: z.enum(['PENDING', 'CONFIRMED', 'DISMISSED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const logIdParamSchema = z.object({
  logId: z.coerce.number().int().positive(),
});

const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
});

const reviewBodySchema = z.object({
  reviewStatus: z.enum(['CONFIRMED', 'DISMISSED']),
  reviewNotes: z.string().trim().max(500).optional(),
});

const terminateBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// GET /api/proctor/kpis
proctorRouter.get('/kpis', async (_req, res, next) => {
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM Exam_Sessions WHERE status = 'IN_PROGRESS') AS active_sessions,
         (SELECT COUNT(*) FROM Proctoring_Logs WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)) AS violations_last_10m,
         (SELECT COUNT(*) FROM Exam_Sessions WHERE status = 'IN_PROGRESS' AND trust_score < 100) AS flagged_students,
         (SELECT COUNT(*) FROM Exam_Sessions WHERE status = 'TERMINATED_CHEATING' AND DATE(ended_at) = CURDATE()) AS terminated_today`
    );
    const row = rows[0] || {};
    sendSuccess(res, {
      activeSessions: Number(row.active_sessions ?? 0),
      violationsLast10Min: Number(row.violations_last_10m ?? 0),
      flaggedStudents: Number(row.flagged_students ?? 0),
      terminatedToday: Number(row.terminated_today ?? 0),
    });
  } catch (err) {
    next(err);
  }
});

const warnBodySchema = z.object({
  message: z.string().trim().min(2).max(500),
});

const reinstateBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .optional();

const bulkReviewBodySchema = z.object({
  logIds: z.array(z.coerce.number().int().positive()).min(1).max(200),
  status: z.enum(['CONFIRMED', 'DISMISSED']).optional(),
  reviewStatus: z.enum(['CONFIRMED', 'DISMISSED']).optional(),
  reviewNotes: z.string().trim().max(500).optional(),
}).refine((v) => Boolean(v.status || v.reviewStatus), {
  message: 'status or reviewStatus is required.',
});

// POST /api/proctor/sessions/:sessionId/warn & /message — dispatch direct proctor intervention warning
const handleProctorWarning = async (req: AuthenticatedRequest, res: Parameters<typeof sendSuccess>[0], next: (e?: unknown) => void) => {
  try {
    const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
    const { message } = req.body as z.infer<typeof warnBodySchema>;

    const sessions = await queryRows<ExamSessionRow[]>(
      'SELECT * FROM Exam_Sessions WHERE id = ? LIMIT 1',
      [sessionId]
    );
    const session = sessions[0];
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
    }

    const warningPayload = {
      sessionId,
      studentId: session.student_id,
      message,
      proctorName: req.user!.fullName,
      issuedAt: new Date().toISOString(),
    };

    emitToStudent(session.student_id, sessionId, 'session:warning', warningPayload);
    emitToProctors('session:warning_issued', warningPayload);

    // QA Fix (Sub-Phase 11.3): Ensure delivered flag is returned for proctor warning confirmations
    sendSuccess(res, {
      sessionId,
      warned: true,
      delivered: true,
      message,
      proctorName: req.user!.fullName,
    });
  } catch (err) {
    next(err);
  }
};

proctorRouter.post(
  '/sessions/:sessionId/warn',
  validate({ params: sessionIdParamSchema, body: warnBodySchema }),
  handleProctorWarning
);

proctorRouter.post(
  '/sessions/:sessionId/message',
  validate({ params: sessionIdParamSchema, body: warnBodySchema }),
  handleProctorWarning
);

// POST /api/proctor/sessions/:sessionId/reinstate — un-terminate cheating session after proctor approval
proctorRouter.post(
  '/sessions/:sessionId/reinstate',
  // Validate both route parameter and optional reinstatement reason payload
  validate({ params: sessionIdParamSchema, body: reinstateBodySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const body = req.body as z.infer<typeof reinstateBodySchema>;
      const reason = body?.reason ?? 'Reinstated by proctor review';

      const sessions = await queryRows<ExamSessionRow[]>(
        'SELECT * FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      const session = sessions[0];
      if (!session) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
      }

      // Restore session to IN_PROGRESS and clear reinstatement flag
      await executeSql(
        `UPDATE Exam_Sessions
            SET status = 'IN_PROGRESS',
                needs_reinstatement = FALSE,
                ended_at = NULL
          WHERE id = ?`,
        [sessionId]
      );

      // Remove preliminary graded Results row so exam can be legitimately taken and re-submitted
      await executeSql('DELETE FROM Results WHERE session_id = ?', [sessionId]);

      const refreshed = await queryRows<ExamSessionRow[]>(
        'SELECT * FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      const updated = refreshed[0];

      const reinstatedPayload = {
        sessionId,
        examId: updated.exam_id,
        studentId: updated.student_id,
        trust_score: updated.trust_score,
        trustScore: updated.trust_score,
        status: updated.status,
        reinstatedBy: req.user!.fullName,
        reason,
      };

      emitSessionUpdate(updated.student_id, sessionId, reinstatedPayload, {
        sessionId,
        trust_score: updated.trust_score,
        status: 'IN_PROGRESS',
      });
      emitToStudent(updated.student_id, sessionId, 'session:reinstated', reinstatedPayload);
      emitToProctors('session:reinstated', reinstatedPayload);

      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/proctor/logs/bulk-review — batch confirm or dismiss violations
proctorRouter.post(
  '/logs/bulk-review',
  validate({ body: bulkReviewBodySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof bulkReviewBodySchema>;
      const status = body.status ?? body.reviewStatus!;
      const notes = body.reviewNotes ?? `Bulk review marked ${status}`;
      const logIds = body.logIds;

      // Single batched query instead of N+1 roundtrips
      const placeholders = logIds.map(() => '?').join(',');
      await executeSql(
        `UPDATE Proctoring_Logs
            SET proctor_review_status = ?,
                reviewed_by = ?,
                reviewed_at = NOW(),
                review_notes = ?
          WHERE id IN (${placeholders})`,
        [status, req.user!.sub, notes, ...logIds]
      );

      // Fetch updated rows from vw_ViolationAuditReport to broadcast new trust scores
      const updatedRows = await queryRows<RowDataPacket[]>(
        `SELECT * FROM vw_ViolationAuditReport WHERE log_id IN (${logIds.map(() => '?').join(',')})`,
        logIds
      );

      for (const row of updatedRows) {
        const studentId = Number(row.student_id);
        const sId = Number(row.session_id);
        const trust = Number(row.current_trust_score);
        const payload = {
          logId: Number(row.log_id),
          sessionId: sId,
          reviewStatus: status,
          reviewerName: req.user!.fullName,
          updatedTrustScore: trust,
          trust_score: trust,
          status: row.session_status,
        };
        emitSessionUpdate(studentId, sId, payload, {
          sessionId: sId,
          trust_score: trust,
          status: String(row.session_status),
        });
        emitToProctors('violation:reviewed', payload);
      }

      sendSuccess(res, {
        updatedCount: logIds.length,
        status,
        logs: updatedRows,
      });
    } catch (err) {
      next(err);
    }
  }
);
proctorRouter.get(
  '/live-monitor',
  validate({ query: liveMonitorQuerySchema }),
  async (req, res, next) => {
    try {
      const { examId, status } = req.query as unknown as z.infer<typeof liveMonitorQuerySchema>;
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (examId !== undefined) {
        conditions.push('exam_id = ?');
        params.push(examId);
      }
      if (status !== undefined) {
        conditions.push('status = ?');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await queryRows<RowDataPacket[]>(
        `SELECT *
           FROM vw_ProctorLiveMonitor
           ${whereClause}
          ORDER BY FIELD(status, 'IN_PROGRESS', 'TERMINATED_CHEATING', 'TIMED_OUT', 'SUBMITTED'),
                   trust_score ASC,
                   started_at DESC`,
        params
      );

      sendSuccess(res, rows);
    } catch (err) {
      next(err);
    }
  }
);

// QA Fix (Sub-Phase 11.3): Alias GET /api/proctor/sessions returning wrapped session list
proctorRouter.get(
  '/sessions',
  validate({ query: liveMonitorQuerySchema }),
  async (req, res, next) => {
    try {
      const { examId, status } = req.query as unknown as z.infer<typeof liveMonitorQuerySchema>;
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (examId !== undefined) {
        conditions.push('exam_id = ?');
        params.push(examId);
      }
      if (status !== undefined) {
        conditions.push('status = ?');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await queryRows<RowDataPacket[]>(
        `SELECT *
           FROM vw_ProctorLiveMonitor
           ${whereClause}
          ORDER BY FIELD(status, 'IN_PROGRESS', 'TERMINATED_CHEATING', 'TIMED_OUT', 'SUBMITTED'),
                   trust_score ASC,
                   started_at DESC`,
        params
      );

      sendSuccess(res, { sessions: rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/proctor/audit-report — queries SQL view vw_ViolationAuditReport
proctorRouter.get(
  '/audit-report',
  validate({ query: auditQuerySchema }),
  async (req, res, next) => {
    try {
      const { examId, sessionId, reviewStatus, severity, limit } = req.query as unknown as z.infer<
        typeof auditQuerySchema
      >;
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (examId !== undefined) {
        conditions.push('exam_id = ?');
        params.push(examId);
      }
      if (sessionId !== undefined) {
        conditions.push('session_id = ?');
        params.push(sessionId);
      }
      if (reviewStatus !== undefined) {
        conditions.push('proctor_review_status = ?');
        params.push(reviewStatus);
      }
      if (severity !== undefined) {
        conditions.push('severity = ?');
        params.push(severity);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      // LIMIT interpolated safely from Zod-validated integer
      const rows = await queryRows<RowDataPacket[]>(
        `SELECT *
           FROM vw_ViolationAuditReport
           ${whereClause}
          ORDER BY occurred_at DESC, log_id DESC
          LIMIT ${Number(limit)}`,
        params
      );

      sendSuccess(res, rows);
    } catch (err) {
      next(err);
    }
  }
);

// QA Fix (Sub-Phase 11.3): Alias GET /api/proctor/logs returning wrapped logs list
proctorRouter.get(
  '/logs',
  validate({ query: auditQuerySchema }),
  async (req, res, next) => {
    try {
      const { examId, sessionId, reviewStatus, severity, limit } = req.query as unknown as z.infer<
        typeof auditQuerySchema
      >;
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (examId !== undefined) {
        conditions.push('exam_id = ?');
        params.push(examId);
      }
      if (sessionId !== undefined) {
        conditions.push('session_id = ?');
        params.push(sessionId);
      }
      if (reviewStatus !== undefined) {
        conditions.push('proctor_review_status = ?');
        params.push(reviewStatus);
      }
      if (severity !== undefined) {
        conditions.push('severity = ?');
        params.push(severity);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await queryRows<RowDataPacket[]>(
        `SELECT *
           FROM vw_ViolationAuditReport
           ${whereClause}
          ORDER BY occurred_at DESC, log_id DESC
          LIMIT ${Number(limit ?? 100)}`,
        params
      );

      sendSuccess(res, { logs: rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/proctor/analytics — queries vw_ExamAnalytics and vw_ViolationHeatmap
proctorRouter.get('/analytics', async (_req, res, next) => {
  try {
    const [exams, heatmap] = await Promise.all([
      queryRows<RowDataPacket[]>('SELECT * FROM vw_ExamAnalytics ORDER BY exam_id ASC'),
      queryRows<RowDataPacket[]>('SELECT * FROM vw_ViolationHeatmap'),
    ]);
    sendSuccess(res, { exams, heatmap });
  } catch (err) {
    next(err);
  }
});

// GET /api/proctor/sessions/:sessionId/inspect
proctorRouter.get(
  '/sessions/:sessionId/inspect',
  validate({ params: sessionIdParamSchema }),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const monitors = await queryRows<RowDataPacket[]>(
        'SELECT * FROM vw_ProctorLiveMonitor WHERE session_id = ? LIMIT 1',
        [sessionId]
      );
      if (!monitors[0]) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
      }

      const logs = await queryRows<RowDataPacket[]>(
        `SELECT *
           FROM vw_ViolationAuditReport
          WHERE session_id = ?
          ORDER BY occurred_at DESC`,
        [sessionId]
      );

      sendSuccess(res, {
        session: monitors[0],
        logs,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/proctor/logs/:logId/review — DB trigger trg_after_violation_review_update handles trust sync
proctorRouter.patch(
  '/logs/:logId/review',
  validate({ params: logIdParamSchema, body: reviewBodySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { logId } = req.params as unknown as z.infer<typeof logIdParamSchema>;
      const { reviewStatus, reviewNotes } = req.body as z.infer<typeof reviewBodySchema>;

      const existing = await queryRows<RowDataPacket[]>(
        'SELECT id, session_id FROM Proctoring_Logs WHERE id = ? LIMIT 1',
        [logId]
      );
      if (!existing[0]) {
        throw new AppError(404, 'LOG_NOT_FOUND', 'Proctoring log entry not found.');
      }

      const sessionId = Number(existing[0].session_id);

      await executeSql(
        `UPDATE Proctoring_Logs
            SET proctor_review_status = ?,
                reviewed_by = ?,
                reviewed_at = NOW(),
                review_notes = ?
          WHERE id = ?`,
        [reviewStatus, req.user!.sub, reviewNotes ?? null, logId]
      );

      const updated = await queryRows<RowDataPacket[]>(
        'SELECT * FROM vw_ViolationAuditReport WHERE log_id = ? LIMIT 1',
        [logId]
      );

      const row = updated[0];
      if (row) {
        const studentId = Number(row.student_id);
        const trust = Number(row.current_trust_score);
        const revPayload = {
          logId,
          sessionId,
          reviewStatus,
          reviewerName: req.user!.fullName,
          updatedTrustScore: trust,
          trust_score: trust,
          sessionStatus: row.session_status,
          status: row.session_status,
        };
        emitSessionUpdate(studentId, sessionId, revPayload, {
          sessionId,
          trust_score: trust,
          status: String(row.session_status),
        });
        emitToProctors('violation:reviewed', revPayload);
        emitToStudent(studentId, sessionId, 'violation:reviewed', revPayload);
      }

      sendSuccess(res, updated[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/proctor/sessions/:sessionId/terminate — manual proctor disqualification
proctorRouter.post(
  '/sessions/:sessionId/terminate',
  validate({ params: sessionIdParamSchema, body: terminateBodySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const { reason } = req.body as z.infer<typeof terminateBodySchema>;

      const sessions = await queryRows<ExamSessionRow[]>(
        'SELECT * FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      const session = sessions[0];
      if (!session) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
      }
      if (session.status !== 'IN_PROGRESS') {
        throw new AppError(409, 'SESSION_ALREADY_CLOSED', 'Session is already closed.');
      }

      await executeSql(
        `UPDATE Exam_Sessions
            SET status = 'TERMINATED_CHEATING',
                ended_at = NOW()
          WHERE id = ? AND status = 'IN_PROGRESS'`,
        [sessionId]
      );

      const [resultSets] = await pool.query<RowDataPacket[][]>(
        'CALL sp_SubmitAndGradeExam(?, ?)',
        [sessionId, 'PROCTOR_TERMINATE']
      );
      const graded = resultSets[0]?.[0] ?? null;

      emitSessionTerminated(
        session.student_id,
        sessionId,
        {
          sessionId,
          examId: session.exam_id,
          studentId: session.student_id,
          trust_score: session.trust_score,
          trustScore: session.trust_score,
          status: 'TERMINATED_CHEATING',
          reason,
          terminatedBy: req.user!.fullName,
          result: graded,
        },
        {
          sessionId,
          trust_score: session.trust_score,
          status: 'TERMINATED_CHEATING',
          reason,
        }
      );

      sendSuccess(res, {
        sessionId,
        status: 'TERMINATED_CHEATING',
        reason,
        result: graded,
      });
    } catch (err) {
      next(err);
    }
  }
);
