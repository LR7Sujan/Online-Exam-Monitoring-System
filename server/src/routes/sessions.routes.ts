import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, pool, queryRows } from '../config/db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  emitExamSubmitted,
  emitSessionTerminated,
  emitSessionUpdate,
  emitViolationNew,
} from '../realtime/socket.js';
import {
  shouldDebounceViolation,
  violationRateLimiter,
} from '../services/violationGuard.js';
import type { ExamSessionRow, ResultRow, ViolationTypeRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { extractClientIp, startOrResumeExamSession } from './exams.routes.js';

export const sessionsRouter = Router();

const startSessionSchema = z.object({
  examId: z.coerce.number().int().positive(),
  deviceFingerprint: z.string().trim().min(1).max(255).optional(),
  sessionToken: z.string().trim().min(1).max(128).optional(),
});

const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
});

const upsertAnswerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  selectedOption: z.enum(['A', 'B', 'C', 'D']),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

export function saveSnapshotImage(sessionId: number, snapshot: string | null | undefined): string | null {
  if (!snapshot) return null;
  const trimmed = snapshot.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    let base64Data = trimmed;
    if (trimmed.includes('base64,')) {
      base64Data = trimmed.split('base64,')[1];
    }
    const cleanB64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
    const filename = `snapshot-${sessionId}-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(cleanB64, 'base64'));
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn('[Snapshot] Failed to write snapshot image:', err);
    return null;
  }
}

const reportViolationSchema = z
  .object({
    code: z.string().trim().min(2).max(40).optional(),
    violationCode: z.string().trim().min(2).max(40).optional(),
    snapshot: z.string().optional().nullable(),
    snapshot_url: z.string().optional().nullable(),
    snapshotUrl: z.string().optional().nullable(),
    evidenceMeta: z.record(z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.code || v.violationCode), {
    message: 'Violation code is required.',
  });

const forceTerminateSchema = z
  .object({
    reason: z.string().trim().min(3).max(500).default('Force-terminated by proctor.'),
  })
  .optional()
  .default({ reason: 'Force-terminated by proctor.' });

async function assertSessionAccess(
  sessionId: number,
  user: AuthenticatedRequest['user']
): Promise<ExamSessionRow> {
  const rows = await queryRows<ExamSessionRow[]>(
    `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.min_trust_score,
            GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining
       FROM Exam_Sessions es
       JOIN Exams e ON e.id = es.exam_id
      WHERE es.id = ?
      LIMIT 1`,
    [sessionId]
  );

  const session = rows[0];
  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
  }

  if (user!.role === 'STUDENT' && session.student_id !== user!.sub) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this exam session.');
  }

  return session;
}

// POST /api/sessions/start (compatibility alias for POST /api/exams/:id/start)
sessionsRouter.post(
  '/start',
  requireAuth,
  requireRole('STUDENT'),
  validate({ body: startSessionSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { examId, deviceFingerprint, sessionToken } = req.body as z.infer<
        typeof startSessionSchema
      >;
      const fp =
        deviceFingerprint ||
        (typeof req.headers['x-device-fingerprint'] === 'string'
          ? req.headers['x-device-fingerprint'].slice(0, 255)
          : (req.headers['user-agent'] ?? 'unknown-device').slice(0, 255));

      const { session, created } = await startOrResumeExamSession({
        examId,
        studentId: req.user!.sub,
        studentName: req.user!.fullName,
        ipAddress: extractClientIp(req),
        deviceFingerprint: fp,
        sessionToken,
      });

      if (created) {
        emitSessionUpdate(
          session.student_id,
          session.id,
          {
            sessionId: session.id,
            examId: session.exam_id,
            studentId: session.student_id,
            studentName: req.user!.fullName,
            trust_score: session.trust_score,
            status: session.status,
          },
          {
            sessionId: session.id,
            trust_score: session.trust_score,
            status: session.status,
          }
        );
      }

      sendSuccess(res, session, created ? 201 : 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:sessionId
sessionsRouter.get(
  '/:sessionId',
  requireAuth,
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      // Never expose correct_option in student exam payload
      const questions = await queryRows<RowDataPacket[]>(
        `SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d,
                marks, order_index
           FROM Questions
          WHERE exam_id = ?
          ORDER BY order_index ASC, id ASC`,
        [session.exam_id]
      );

      const responses = await queryRows<RowDataPacket[]>(
        `SELECT question_id, selected_option, answered_at
           FROM Student_Responses
          WHERE session_id = ?`,
        [sessionId]
      );

      const recentLogs = await queryRows<RowDataPacket[]>(
        `SELECT pl.id, pl.penalty_applied, pl.occurred_at, pl.proctor_review_status,
                pl.snapshot_url, pl.evidence_meta,
                vt.code AS violation_code, vt.label AS violation_label, vt.severity
           FROM Proctoring_Logs pl
           JOIN Violation_Types vt ON vt.id = pl.violation_type_id
          WHERE pl.session_id = ?
          ORDER BY pl.occurred_at DESC
          LIMIT 25`,
        [sessionId]
      );

      sendSuccess(res, {
        session,
        questions,
        responses,
        recentLogs,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:sessionId/questions — never returns correct_option
sessionsRouter.get(
  '/:sessionId/questions',
  requireAuth,
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      const questions = await queryRows<RowDataPacket[]>(
        `SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d,
                marks, order_index
           FROM Questions
          WHERE exam_id = ?
          ORDER BY order_index ASC, id ASC`,
        [session.exam_id]
      );

      const responses = await queryRows<RowDataPacket[]>(
        `SELECT question_id, selected_option, answered_at
           FROM Student_Responses
          WHERE session_id = ?`,
        [sessionId]
      );

      sendSuccess(res, {
        sessionId: session.id,
        examId: session.exam_id,
        status: session.status,
        questions,
        responses,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:sessionId/time-left — server-authoritative remaining seconds
sessionsRouter.get(
  '/:sessionId/time-left',
  requireAuth,
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      const rows = await queryRows<RowDataPacket[]>(
        `SELECT NOW() AS server_now,
                server_deadline,
                status,
                trust_score,
                GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), server_deadline)) AS seconds_left
           FROM Exam_Sessions
          WHERE id = ?
          LIMIT 1`,
        [session.id]
      );

      const row = rows[0];
      sendSuccess(res, {
        sessionId: session.id,
        status: row.status,
        trustScore: Number(row.trust_score),
        secondsLeft: row.status === 'IN_PROGRESS' ? Number(row.seconds_left) : 0,
        serverDeadline: row.server_deadline,
        serverNow: row.server_now,
      });
    } catch (err) {
      next(err);
    }
  }
);

async function handleUpsertAnswer(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
    const { questionId, selectedOption } = req.body as z.infer<typeof upsertAnswerSchema>;

    await assertSessionAccess(sessionId, req.user);

    await executeSql(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         selected_option = VALUES(selected_option),
         answered_at = CURRENT_TIMESTAMP`,
      [sessionId, questionId, selectedOption]
    );

    sendSuccess(res, {
      sessionId,
      questionId,
      selectedOption,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/sessions/:sessionId/answer (and /responses alias)
sessionsRouter.put(
  '/:sessionId/answer',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema, body: upsertAnswerSchema }),
  handleUpsertAnswer
);

sessionsRouter.put(
  '/:sessionId/responses',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema, body: upsertAnswerSchema }),
  handleUpsertAnswer
);

// POST /api/sessions/:sessionId/violation — rate-limited + 3s debounced + trigger-enforced
sessionsRouter.post(
  '/:sessionId/violation',
  requireAuth,
  requireRole('STUDENT'),
  violationRateLimiter,
  validate({ params: sessionIdParamSchema, body: reportViolationSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const body = req.body as z.infer<typeof reportViolationSchema>;
      const code = (body.code ?? body.violationCode ?? '').toUpperCase();

      const session = await assertSessionAccess(sessionId, req.user);

      if (shouldDebounceViolation(sessionId, code)) {
        sendSuccess(res, {
          sessionId,
          code,
          debounced: true,
          trust_score: session.trust_score,
          status: session.status,
          minTrustScore: session.min_trust_score ?? 50,
        });
        return;
      }

      const typeRows = await queryRows<ViolationTypeRow[]>(
        'SELECT id, code, label, penalty_points, severity FROM Violation_Types WHERE code = ? LIMIT 1',
        [code]
      );
      const vType = typeRows[0];
      if (!vType) {
        throw new AppError(400, 'INVALID_VIOLATION_CODE', `Unknown violation code: ${code}`);
      }

      const rawSnapshot = body.snapshot || (body.evidenceMeta as any)?.snapshot;
      const explicitUrl =
        body.snapshot_url ||
        body.snapshotUrl ||
        (body.evidenceMeta as any)?.snapshot_url ||
        (body.evidenceMeta as any)?.snapshotUrl;
      const savedSnapshotUrl = explicitUrl || saveSnapshotImage(sessionId, rawSnapshot);

      const evidencePayload = JSON.stringify({
        ...(body.evidenceMeta ?? {}),
        ...(savedSnapshotUrl ? { snapshot_url: savedSnapshotUrl, snapshotUrl: savedSnapshotUrl } : {}),
      });

      const insertRes = await executeSql(
        `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta, snapshot_url)
         VALUES (?, ?, ?, ?)`,
        [sessionId, vType.id, evidencePayload, savedSnapshotUrl]
      );

      const updatedRows = await queryRows<ExamSessionRow[]>(
        `SELECT es.*, e.min_trust_score, e.title AS exam_title
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?
          LIMIT 1`,
        [sessionId]
      );
      const updated = updatedRows[0];

      const basePayload = {
        logId: insertRes.insertId,
        sessionId,
        examId: updated.exam_id,
        studentId: updated.student_id,
        studentName: req.user!.fullName,
        violationCode: vType.code,
        violationLabel: vType.label,
        severity: vType.severity,
        penaltyApplied: vType.penalty_points,
        trust_score: updated.trust_score,
        trustScore: updated.trust_score,
        minTrustScore: updated.min_trust_score,
        status: updated.status,
        sessionStatus: updated.status,
        snapshot_url: savedSnapshotUrl,
        snapshotUrl: savedSnapshotUrl,
        occurredAt: new Date().toISOString(),
      };

      emitViolationNew(updated.student_id, sessionId, basePayload, {
        sessionId,
        trust_score: updated.trust_score,
        status: updated.status,
      });

      let gradedResult = null;
      if (updated.status === 'TERMINATED_CHEATING') {
        const [resultSets] = await pool.query<RowDataPacket[][]>(
          'CALL sp_SubmitAndGradeExam(?, ?)',
          [sessionId, 'AUTO_TERMINATED']
        );
        gradedResult = resultSets[0]?.[0] ?? null;

        emitSessionTerminated(
          updated.student_id,
          sessionId,
          { ...basePayload, reason: vType.code, result: gradedResult },
          {
            sessionId,
            trust_score: updated.trust_score,
            status: updated.status,
            reason: vType.code,
          }
        );
      }

      sendSuccess(
        res,
        {
          logId: insertRes.insertId,
          code: vType.code,
          penaltyApplied: vType.penalty_points,
          trust_score: updated.trust_score,
          trustScore: updated.trust_score,
          minTrustScore: updated.min_trust_score,
          status: updated.status,
          snapshot_url: savedSnapshotUrl,
          snapshotUrl: savedSnapshotUrl,
          debounced: false,
          result: gradedResult,
        },
        201
      );
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sessions/:sessionId/heartbeat
sessionsRouter.post(
  '/:sessionId/heartbeat',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      if (session.status !== 'IN_PROGRESS') {
        sendSuccess(res, {
          sessionId: session.id,
          status: session.status,
          trustScore: session.trust_score,
          secondsRemaining: 0,
        });
        return;
      }

      await executeSql('UPDATE Exam_Sessions SET last_heartbeat_at = NOW() WHERE id = ?', [
        sessionId,
      ]);

      const refreshed = await assertSessionAccess(sessionId, req.user);
      if (Number(refreshed.seconds_remaining ?? 0) <= 0 && refreshed.status === 'IN_PROGRESS') {
        const [resultSets] = await pool.query<RowDataPacket[][]>(
          'CALL sp_SubmitAndGradeExam(?, ?)',
          [sessionId, 'TIMEOUT']
        );
        const graded = resultSets[0]?.[0];

        emitExamSubmitted(
          refreshed.student_id,
          sessionId,
          { sessionId, status: 'TIMED_OUT', trust_score: refreshed.trust_score, result: graded },
          { sessionId, trust_score: refreshed.trust_score, status: 'TIMED_OUT', result: graded }
        );

        sendSuccess(res, {
          sessionId,
          status: 'TIMED_OUT',
          trustScore: refreshed.trust_score,
          secondsRemaining: 0,
          result: graded,
        });
        return;
      }

      sendSuccess(res, {
        sessionId,
        status: refreshed.status,
        trustScore: refreshed.trust_score,
        secondsRemaining: Number(refreshed.seconds_remaining ?? 0),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sessions/:sessionId/submit — transactional grading via sp_SubmitAndGradeExam
sessionsRouter.post(
  '/:sessionId/submit',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      const [resultSets] = await pool.query<RowDataPacket[][]>(
        'CALL sp_SubmitAndGradeExam(?, ?)',
        [sessionId, 'STUDENT_SUBMIT']
      );
      const result = resultSets[0]?.[0];
      const finalStatus = String(result?.session_status ?? 'SUBMITTED');
      const finalTrust = Number(result?.final_trust_score ?? session.trust_score);

      emitExamSubmitted(
        session.student_id,
        sessionId,
        {
          sessionId,
          examId: session.exam_id,
          studentId: session.student_id,
          status: finalStatus,
          trust_score: finalTrust,
          result,
        },
        {
          sessionId,
          trust_score: finalTrust,
          status: finalStatus,
          result,
        }
      );

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:sessionId/result
sessionsRouter.get(
  '/:sessionId/result',
  requireAuth,
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      const results = await queryRows<ResultRow[]>(
        `SELECT r.*, e.title AS exam_title, e.min_trust_score, u.full_name AS student_name, u.email AS student_email
           FROM Results r
           JOIN Exam_Sessions es ON es.id = r.session_id
           JOIN Exams e ON e.id = es.exam_id
           JOIN Users u ON u.id = es.student_id
          WHERE r.session_id = ?
          LIMIT 1`,
        [sessionId]
      );

      if (!results[0]) {
        throw new AppError(404, 'RESULT_NOT_READY', 'Exam result has not been graded yet.');
      }

      const violations = await queryRows<RowDataPacket[]>(
        `SELECT log_id, violation_code, violation_label, severity, penalty_applied,
                occurred_at, proctor_review_status, review_notes
           FROM vw_ViolationAuditReport
          WHERE session_id = ?
          ORDER BY occurred_at DESC`,
        [sessionId]
      );

      sendSuccess(res, {
        session,
        result: results[0],
        violations,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:sessionId/timeline (PROCTOR | ADMIN)
sessionsRouter.get(
  '/:sessionId/timeline',
  requireAuth,
  requireRole('PROCTOR', 'ADMIN'),
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
          ORDER BY occurred_at ASC, log_id ASC`,
        [sessionId]
      );

      sendSuccess(res, {
        session: monitors[0],
        timeline: logs,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sessions/:sessionId/force-terminate (PROCTOR | ADMIN)
sessionsRouter.post(
  '/:sessionId/force-terminate',
  requireAuth,
  requireRole('PROCTOR', 'ADMIN'),
  validate({ params: sessionIdParamSchema, body: forceTerminateSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const { reason } = req.body as z.infer<typeof forceTerminateSchema>;

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
        [sessionId, 'PROCTOR_FORCE_TERMINATE']
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
