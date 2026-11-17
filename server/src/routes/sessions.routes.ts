import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, pool, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  emitExamSubmitted,
  emitExtensionRequested,
  emitSessionTerminated,
  emitSessionUpdate,
  emitViolationNew,
  emitWarningAcked,
  emitWarningIssued,
} from '../realtime/socket.js';
import {
  mapDisplayedToOriginalAnswer,
  mapOriginalToDisplayedAnswer,
  mapQuestionForStudent,
} from '../services/paperGenerator.js';
import {
  shouldDebounceViolation,
  violationRateLimiter,
} from '../services/violationGuard.js';
import type { AnswerOption, ExamSessionRow, ResultRow, SessionWarningRow, TimeExtensionRequestRow, ViolationTypeRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { extractClientIp, startOrResumeExamSession } from './exams.routes.js';

export const sessionsRouter = Router();

const warningIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  warningId: z.coerce.number().int().positive(),
});

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
// Resolve uploads directory relative to project root or script location
const projectRootDir = path.resolve(__dirname, '../../../');
const uploadsDir = env.UPLOADS_DIR
  ? path.resolve(projectRootDir, env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

// QA Security Fix (Sub-Phase 11.4): Reject non-images and oversized uploads (> 2MB)
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024; // 2MB

export function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }
  return false;
}

export function saveSnapshotImage(sessionId: number, snapshot: string | null | undefined): string | null {
  if (!snapshot) return null;
  const trimmed = snapshot.trim();

  if (trimmed.startsWith('/uploads/')) {
    if (trimmed.includes('..') || trimmed.includes('\\')) {
      throw new AppError(400, 'INVALID_SNAPSHOT_PATH', 'Path traversal in snapshot URL is forbidden.');
    }
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Validate data URI prefix if present
  if (trimmed.startsWith('data:')) {
    const isImage =
      trimmed.startsWith('data:image/jpeg') ||
      trimmed.startsWith('data:image/png') ||
      trimmed.startsWith('data:image/webp') ||
      trimmed.startsWith('data:image/jpg');
    if (!isImage) {
      throw new AppError(
        400,
        'INVALID_SNAPSHOT_FORMAT',
        'Snapshot upload must be an image format (JPEG, PNG, or WebP).'
      );
    }
  }

  let base64Data = trimmed;
  if (trimmed.includes('base64,')) {
    base64Data = trimmed.split('base64,')[1];
  }
  const cleanB64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
  const buffer = Buffer.from(cleanB64, 'base64');

  if (buffer.length > MAX_SNAPSHOT_BYTES) {
    throw new AppError(400, 'SNAPSHOT_OVERSIZED', 'Snapshot file exceeds maximum allowed size of 2MB.');
  }

  if (buffer.length >= 32 && !isValidImageBuffer(buffer)) {
    throw new AppError(400, 'INVALID_SNAPSHOT_FORMAT', 'Snapshot content is not a valid JPEG, PNG, or WebP image.');
  }

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const ext = buffer[0] === 0x89 ? 'png' : (buffer[0] === 0x52 ? 'webp' : 'jpg');
    const filename = `snapshot-${sessionId}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
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
    `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.min_trust_score, e.max_extension_mins,
            GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
            TIMESTAMPDIFF(SECOND, es.server_deadline, NOW()) AS seconds_overdue,
            TIMESTAMPDIFF(SECOND, es.last_warning_ack_at, NOW()) AS seconds_since_ack
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

  const graceSeconds = env.EXTENSION_GRACE_SECONDS ?? 180;
  const overdueSecs = Number(session.seconds_overdue ?? 0);
  const inGrace = session.status === 'IN_PROGRESS' &&
    Number(session.max_extension_mins ?? 0) > 0 &&
    overdueSecs >= 0 &&
    overdueSecs <= graceSeconds;

  session.in_grace_window = inGrace;

  // Auto-record time_expired_at if past regular deadline
  if (overdueSecs >= 0 && !session.time_expired_at && session.status === 'IN_PROGRESS') {
    session.time_expired_at = session.server_deadline;
    executeSql(
      'UPDATE Exam_Sessions SET time_expired_at = COALESCE(time_expired_at, server_deadline, NOW()) WHERE id = ? AND time_expired_at IS NULL',
      [sessionId]
    ).catch(() => {});
  }

  const extRows = await queryRows<TimeExtensionRequestRow[]>(
    `SELECT request_id, session_id, requested_minutes, reason, status, granted_minutes,
            decided_by, decided_at, created_at
       FROM Time_Extension_Requests
      WHERE session_id = ?
      ORDER BY request_id DESC
      LIMIT 1`,
    [sessionId]
  );
  session.extension_request = extRows[0] ?? null;

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

      let pendingWarning = null;
      if (session.pending_warning_log_id) {
        const pwRows = await queryRows<SessionWarningRow[]>(
          `SELECT sw.*, pl.snapshot_url, pl.evidence_meta, vt.label AS violation_label
             FROM Session_Warnings sw
             LEFT JOIN Proctoring_Logs pl ON pl.id = sw.log_id
             LEFT JOIN Violation_Types vt ON vt.code = sw.violation_code
            WHERE sw.session_id = ? AND sw.acknowledged_at IS NULL
            ORDER BY sw.warning_id DESC LIMIT 1`,
          [sessionId]
        );
        if (pwRows[0]) {
          pendingWarning = {
            warningId: pwRows[0].warning_id,
            sessionId: pwRows[0].session_id,
            logId: pwRows[0].log_id,
            violationCode: pwRows[0].violation_code,
            violationLabel: (pwRows[0] as unknown as { violation_label?: string }).violation_label,
            message: pwRows[0].message,
            penaltyPoints: pwRows[0].penalty_points,
            trustScoreAfter: pwRows[0].trust_score_after,
            warningCount: session.warning_count,
            issuedAt: pwRows[0].issued_at,
            snapshotUrl: (pwRows[0] as unknown as { snapshot_url?: string | null }).snapshot_url ?? null,
            evidenceMeta: (pwRows[0] as unknown as { evidence_meta?: unknown }).evidence_meta ?? null,
          };
        }
      }

      // Map questions and options to student's unique paper layout
      let questionOrder: number[] = [];
      let optionMaps: Record<string, AnswerOption[]> = {};
      if (session.question_order) {
        questionOrder = typeof session.question_order === 'string'
          ? JSON.parse(session.question_order)
          : session.question_order;
      }
      if (session.option_maps) {
        optionMaps = typeof session.option_maps === 'string'
          ? JSON.parse(session.option_maps)
          : session.option_maps;
      }

      const qMap = new Map<number, RowDataPacket>(questions.map((q) => [Number(q.id), q]));
      const orderedQuestions = (questionOrder.length > 0
        ? questionOrder.map((id) => qMap.get(id)).filter(Boolean)
        : questions) as RowDataPacket[];

      const mappedQuestions = orderedQuestions.map((q, idx) => {
        const oMap = optionMaps[String(q.id)];
        return mapQuestionForStudent(q as any, oMap, idx + 1);
      });

      const mappedResponses = responses.map((r) => {
        const oMap = optionMaps[String(r.question_id)];
        return {
          ...r,
          selected_option: r.selected_option ? mapOriginalToDisplayedAnswer(r.selected_option, oMap) : null,
        };
      });

      // Strip secret option_maps and paper_hash from student session payload
      const {
        option_maps: _stripMaps,
        paper_hash: _stripHash,
        ...safeSession
      } = session;

      sendSuccess(res, {
        session: safeSession,
        questions: mappedQuestions,
        responses: mappedResponses,
        recentLogs,
        extensionRequest: session.extension_request ?? null,
        pendingWarning,
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

      let pendingWarning = null;
      if (session.pending_warning_log_id) {
        const pwRows = await queryRows<SessionWarningRow[]>(
          `SELECT sw.*, pl.snapshot_url, pl.evidence_meta, vt.label AS violation_label
             FROM Session_Warnings sw
             LEFT JOIN Proctoring_Logs pl ON pl.id = sw.log_id
             LEFT JOIN Violation_Types vt ON vt.code = sw.violation_code
            WHERE sw.session_id = ? AND sw.acknowledged_at IS NULL
            ORDER BY sw.warning_id DESC LIMIT 1`,
          [sessionId]
        );
        if (pwRows[0]) {
          pendingWarning = {
            warningId: pwRows[0].warning_id,
            sessionId: pwRows[0].session_id,
            logId: pwRows[0].log_id,
            violationCode: pwRows[0].violation_code,
            violationLabel: (pwRows[0] as unknown as { violation_label?: string }).violation_label,
            message: pwRows[0].message,
            penaltyPoints: pwRows[0].penalty_points,
            trustScoreAfter: pwRows[0].trust_score_after,
            warningCount: session.warning_count,
            issuedAt: pwRows[0].issued_at,
            snapshotUrl: (pwRows[0] as unknown as { snapshot_url?: string | null }).snapshot_url ?? null,
            evidenceMeta: (pwRows[0] as unknown as { evidence_meta?: unknown }).evidence_meta ?? null,
          };
        }
      }

      // Map questions and options to student's unique paper layout
      let questionOrder: number[] = [];
      let optionMaps: Record<string, AnswerOption[]> = {};
      if (session.question_order) {
        questionOrder = typeof session.question_order === 'string'
          ? JSON.parse(session.question_order)
          : session.question_order;
      }
      if (session.option_maps) {
        optionMaps = typeof session.option_maps === 'string'
          ? JSON.parse(session.option_maps)
          : session.option_maps;
      }

      const qMap = new Map<number, RowDataPacket>(questions.map((q) => [Number(q.id), q]));
      const orderedQuestions = (questionOrder.length > 0
        ? questionOrder.map((id) => qMap.get(id)).filter(Boolean)
        : questions) as RowDataPacket[];

      const mappedQuestions = orderedQuestions.map((q, idx) => {
        const oMap = optionMaps[String(q.id)];
        return mapQuestionForStudent(q as any, oMap, idx + 1);
      });

      const mappedResponses = responses.map((r) => {
        const oMap = optionMaps[String(r.question_id)];
        return {
          ...r,
          selected_option: r.selected_option ? mapOriginalToDisplayedAnswer(r.selected_option, oMap) : null,
        };
      });

      sendSuccess(res, {
        sessionId: session.id,
        examId: session.exam_id,
        status: session.status,
        paperCode: session.paper_code,
        questions: mappedQuestions,
        responses: mappedResponses,
        pendingWarning,
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
                extra_minutes_granted,
                GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), server_deadline)) AS seconds_left
           FROM Exam_Sessions
          WHERE id = ?
          LIMIT 1`,
        [session.id]
      );

      const row = rows[0];
      const graceSeconds = env.EXTENSION_GRACE_SECONDS ?? 180;
      const overdueSecs = Number(session.seconds_overdue ?? 0);
      const inGrace = Boolean(session.in_grace_window);
      const remainingSecs = row.status === 'IN_PROGRESS' ? Number(row.seconds_left) : 0;
      const maxExt = Number(session.max_extension_mins ?? 30);
      const isEligible = row.status === 'IN_PROGRESS' &&
        maxExt > 0 &&
        (remainingSecs <= 600 || inGrace) &&
        !session.extension_request;

      // QA Fix (Sub-Phase 11.3): Expose both camelCase and snake_case aliases for clock & remaining seconds
      sendSuccess(res, {
        sessionId: session.id,
        status: row.status,
        trustScore: Number(row.trust_score),
        secondsLeft: remainingSecs,
        secondsRemaining: remainingSecs,
        serverDeadline: row.server_deadline,
        serverNow: row.server_now,
        serverTime: row.server_now,
        timeExpiredAt: session.time_expired_at ?? null,
        inGraceWindow: inGrace,
        graceSecondsRemaining: inGrace ? Math.max(0, graceSeconds - overdueSecs) : 0,
        extensionEligible: isEligible,
        maxExtensionMins: maxExt,
        extraMinutesGranted: Number(row.extra_minutes_granted ?? session.extra_minutes_granted ?? 0),
        extensionRequest: session.extension_request ?? null,
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

    const session = await assertSessionAccess(sessionId, req.user);
    if (session.status !== 'IN_PROGRESS') {
      throw new AppError(409, 'SESSION_ALREADY_CLOSED', 'Exam session is not in progress.');
    }

    if (session.extension_request?.status === 'PENDING') {
      throw new AppError(
        403,
        'EXTENSION_PENDING_ANSWERS_LOCKED',
        'Answers are locked while your time extension request is pending proctor review.'
      );
    }

    // Map displayed option choice to canonical database option letter
    let optionMaps: Record<string, AnswerOption[]> = {};
    if (session.option_maps) {
      optionMaps = typeof session.option_maps === 'string'
        ? JSON.parse(session.option_maps)
        : session.option_maps;
    }
    const oMap = optionMaps[String(questionId)];
    const originalLetter = mapDisplayedToOriginalAnswer(selectedOption, oMap);

    await executeSql(
      `INSERT INTO Student_Responses (session_id, question_id, selected_option)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         selected_option = VALUES(selected_option),
         answered_at = CURRENT_TIMESTAMP`,
      [sessionId, questionId, originalLetter]
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

// QA Fix (Sub-Phase 11.3): Support POST aliases for answer and response submission
sessionsRouter.post(
  '/:sessionId/answer',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema, body: upsertAnswerSchema }),
  handleUpsertAnswer
);

sessionsRouter.post(
  '/:sessionId/response',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema, body: upsertAnswerSchema }),
  handleUpsertAnswer
);

sessionsRouter.post(
  '/:sessionId/responses',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema, body: upsertAnswerSchema }),
  handleUpsertAnswer
);

// POST /api/sessions/:sessionId/violation — rate-limited + 3s debounced + trigger-enforced + warning gated
sessionsRouter.post(
  '/:sessionId/violation',
  requireAuth,
  requireRole('STUDENT'),
  violationRateLimiter,
  validate({ params: sessionIdParamSchema, body: reportViolationSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    let connection: Awaited<ReturnType<typeof pool.getConnection>> | null = null;
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const body = req.body as z.infer<typeof reportViolationSchema>;
      const code = (body.code ?? body.violationCode ?? '').toUpperCase();

      const session = await assertSessionAccess(sessionId, req.user);

      const typeRows = await queryRows<ViolationTypeRow[]>(
        'SELECT id, code, label, penalty_points, severity FROM Violation_Types WHERE code = ? LIMIT 1',
        [code]
      );
      const vType = typeRows[0];
      if (!vType) {
        throw new AppError(400, 'INVALID_VIOLATION_CODE', `Unknown violation code: ${code}`);
      }

      const meta = body.evidenceMeta as Record<string, unknown> | undefined;
      const rawSnapshot = body.snapshot || (typeof meta?.snapshot === 'string' ? meta.snapshot : undefined);
      const explicitUrl =
        body.snapshot_url ||
        body.snapshotUrl ||
        (typeof meta?.snapshot_url === 'string' ? meta.snapshot_url : undefined) ||
        (typeof meta?.snapshotUrl === 'string' ? meta.snapshotUrl : undefined);

      // QA Security Fix (Sub-Phase 11.4): Validate snapshot payload before debounce check so malformed/oversized uploads are rejected immediately (400)
      const savedSnapshotUrl = explicitUrl
        ? saveSnapshotImage(sessionId, explicitUrl)
        : saveSnapshotImage(sessionId, rawSnapshot);

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

      // Fast check 1: Warning Gate - unacknowledged warning pending
      if (session.pending_warning_log_id !== null && session.pending_warning_log_id !== undefined) {
        sendSuccess(res, {
          ignored: true,
          reason: 'WARNING_PENDING',
          sessionId,
          code: vType.code,
          trust_score: session.trust_score,
          trustScore: session.trust_score,
          status: session.status,
          minTrustScore: session.min_trust_score ?? 50,
          pendingWarningLogId: session.pending_warning_log_id,
        });
        return;
      }

      // Fast check 2: Warning Grace Window - within WARNING_GRACE_SECONDS after ack
      const graceSeconds = env.WARNING_GRACE_SECONDS ?? 5;
      const secondsSinceAck =
        session.seconds_since_ack !== null && session.seconds_since_ack !== undefined
          ? Number(session.seconds_since_ack)
          : session.last_warning_ack_at
            ? (Date.now() - new Date(session.last_warning_ack_at).getTime()) / 1000
            : null;

      if (secondsSinceAck !== null && secondsSinceAck >= 0 && secondsSinceAck < graceSeconds) {
        sendSuccess(res, {
          ignored: true,
          reason: 'WARNING_GRACE',
          sessionId,
          code: vType.code,
          trust_score: session.trust_score,
          trustScore: session.trust_score,
          status: session.status,
          minTrustScore: session.min_trust_score ?? 50,
          graceSecondsRemaining: Math.max(0, Math.ceil(graceSeconds - secondsSinceAck)),
        });
        return;
      }

      const evidencePayload = JSON.stringify({
        ...(body.evidenceMeta ?? {}),
        ...(savedSnapshotUrl ? { snapshot_url: savedSnapshotUrl, snapshotUrl: savedSnapshotUrl } : {}),
      });

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Row-lock session to check status and concurrency
      const [lockedRows] = await connection.query<ExamSessionRow[]>(
        `SELECT es.*, e.min_trust_score, e.title AS exam_title,
                TIMESTAMPDIFF(SECOND, es.last_warning_ack_at, NOW()) AS seconds_since_ack
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?
          FOR UPDATE`,
        [sessionId]
      );
      const lockedSession = lockedRows[0];
      if (!lockedSession) {
        await connection.rollback();
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
      }

      if (lockedSession.status !== 'IN_PROGRESS') {
        await connection.rollback();
        sendSuccess(res, {
          ignored: true,
          reason: 'SESSION_NOT_IN_PROGRESS',
          sessionId,
          status: lockedSession.status,
          trust_score: lockedSession.trust_score,
        });
        return;
      }

      // Concurrency check on warning gate
      if (lockedSession.pending_warning_log_id !== null && lockedSession.pending_warning_log_id !== undefined) {
        await connection.rollback();
        sendSuccess(res, {
          ignored: true,
          reason: 'WARNING_PENDING',
          sessionId,
          code: vType.code,
          trust_score: lockedSession.trust_score,
          status: lockedSession.status,
          pendingWarningLogId: lockedSession.pending_warning_log_id,
        });
        return;
      }

      const lockedSinceAck =
        lockedSession.seconds_since_ack !== null && lockedSession.seconds_since_ack !== undefined
          ? Number(lockedSession.seconds_since_ack)
          : lockedSession.last_warning_ack_at
            ? (Date.now() - new Date(lockedSession.last_warning_ack_at).getTime()) / 1000
            : null;

      if (lockedSinceAck !== null && lockedSinceAck >= 0 && lockedSinceAck < graceSeconds) {
        await connection.rollback();
        sendSuccess(res, {
          ignored: true,
          reason: 'WARNING_GRACE',
          sessionId,
          code: vType.code,
          trust_score: lockedSession.trust_score,
          status: lockedSession.status,
          graceSecondsRemaining: Math.max(0, Math.ceil(graceSeconds - lockedSinceAck)),
        });
        return;
      }

      const [insertResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta, snapshot_url)
         VALUES (?, ?, ?, ?)`,
        [sessionId, vType.id, evidencePayload, savedSnapshotUrl]
      );
      const logId = insertResult.insertId;

      // Query updated session state after trigger deduction
      const [updatedRows] = await connection.query<ExamSessionRow[]>(
        `SELECT es.*, e.min_trust_score, e.title AS exam_title
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?`,
        [sessionId]
      );
      const updated = updatedRows[0];

      const basePayload = {
        logId,
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

      let gradedResult = null;
      if (updated.status === 'TERMINATED_CHEATING') {
        await connection.commit();

        const [resultSets] = await pool.query<RowDataPacket[][]>(
          'CALL sp_SubmitAndGradeExam(?, ?)',
          [sessionId, 'AUTO_TERMINATED']
        );
        gradedResult = resultSets[0]?.[0] ?? null;

        emitViolationNew(updated.student_id, sessionId, basePayload, {
          sessionId,
          trust_score: updated.trust_score,
          status: updated.status,
        });

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

        sendSuccess(
          res,
          {
            logId,
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
        return;
      }

      // Generate human-friendly warning message
      const warningMessages: Record<string, string> = {
        PHONE_DETECTED: 'Mobile phone visible in camera frame. Keep all mobile devices out of view.',
        VOICE_DETECTED: 'Sustained speech detected on microphone. Maintain a quiet testing environment.',
        MULTIPLE_FACES: 'Multiple faces detected in camera feed. Ensure you are alone during the assessment.',
        NO_FACE: 'No face detected in camera view. Ensure your camera is centered and unobstructed.',
        TAB_SWITCH: 'Tab or window switch detected. Please remain on the exam screen.',
        FULLSCREEN_EXIT: 'Full-screen mode exited. Return to full-screen mode immediately.',
        COPY_PASTE: 'Clipboard copy or paste attempt intercepted. External copying is prohibited.',
        DEVTOOLS_OPEN: 'Developer tools detected. Close inspect and devtools immediately.',
      };
      const warningMessage =
        warningMessages[vType.code] ?? `${vType.label}: Violation detected. Please adhere to proctoring guidelines.`;

      const [warningInsert] = await connection.query<ResultSetHeader>(
        `INSERT INTO Session_Warnings (session_id, log_id, violation_code, message, penalty_points, trust_score_after, issued_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [sessionId, logId, vType.code, warningMessage, vType.penalty_points, updated.trust_score]
      );
      const warningId = warningInsert.insertId;

      await connection.query(
        `UPDATE Exam_Sessions
            SET pending_warning_log_id = ?,
                warning_count = warning_count + 1
          WHERE id = ?`,
        [logId, sessionId]
      );

      await connection.commit();

      const newWarningCount = (lockedSession.warning_count ?? 0) + 1;
      const warningPayload = {
        warningId,
        sessionId,
        logId,
        violationCode: vType.code,
        violationLabel: vType.label,
        message: warningMessage,
        penaltyPoints: vType.penalty_points,
        trustScoreAfter: updated.trust_score,
        warningCount: newWarningCount,
        issuedAt: new Date().toISOString(),
      };

      emitViolationNew(updated.student_id, sessionId, basePayload, {
        sessionId,
        trust_score: updated.trust_score,
        status: updated.status,
      });

      emitWarningIssued(updated.student_id, sessionId, warningPayload);

      sendSuccess(
        res,
        {
          logId,
          code: vType.code,
          penaltyApplied: vType.penalty_points,
          trust_score: updated.trust_score,
          trustScore: updated.trust_score,
          minTrustScore: updated.min_trust_score,
          status: updated.status,
          snapshot_url: savedSnapshotUrl,
          snapshotUrl: savedSnapshotUrl,
          debounced: false,
          warning: warningPayload,
        },
        201
      );
    } catch (err) {
      if (connection) {
        await connection.rollback().catch(() => {});
      }
      next(err);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// POST /api/sessions/:sessionId/warnings/:warningId/ack — student acknowledgment
sessionsRouter.post(
  '/:sessionId/warnings/:warningId/ack',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: warningIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    let connection: Awaited<ReturnType<typeof pool.getConnection>> | null = null;
    try {
      const { sessionId, warningId } = req.params as unknown as z.infer<typeof warningIdParamSchema>;
      const session = await assertSessionAccess(sessionId, req.user);

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [warnings] = await connection.query<SessionWarningRow[]>(
        'SELECT * FROM Session_Warnings WHERE warning_id = ? AND session_id = ? FOR UPDATE',
        [warningId, sessionId]
      );
      const warning = warnings[0];
      if (!warning) {
        await connection.rollback();
        throw new AppError(404, 'WARNING_NOT_FOUND', 'Warning not found for this exam session.');
      }

      const graceSeconds = env.WARNING_GRACE_SECONDS ?? 5;

      if (warning.acknowledged_at) {
        await connection.rollback();
        sendSuccess(res, {
          acknowledged: true,
          alreadyAcknowledged: true,
          warningId: warning.warning_id,
          acknowledgedAt: warning.acknowledged_at,
          graceSeconds,
        });
        return;
      }

      await connection.query(
        'UPDATE Session_Warnings SET acknowledged_at = NOW() WHERE warning_id = ?',
        [warningId]
      );

      await connection.query(
        `UPDATE Exam_Sessions
            SET pending_warning_log_id = NULL,
                last_warning_ack_at = NOW()
          WHERE id = ?`,
        [sessionId]
      );

      await connection.commit();

      const ackedAt = new Date().toISOString();
      const ackPayload = {
        warningId,
        sessionId,
        acknowledgedAt: ackedAt,
        graceSeconds,
      };

      emitWarningAcked(session.student_id, sessionId, ackPayload);

      sendSuccess(res, {
        acknowledged: true,
        warningId,
        acknowledgedAt: ackedAt,
        graceSeconds,
      });
    } catch (err) {
      if (connection) {
        await connection.rollback().catch(() => {});
      }
      next(err);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// GET /api/sessions/:sessionId/warnings — list session warning history
sessionsRouter.get(
  '/:sessionId/warnings',
  requireAuth,
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      await assertSessionAccess(sessionId, req.user);

      const rows = await queryRows<SessionWarningRow[]>(
        `SELECT warning_id, session_id, log_id, violation_code, message,
                penalty_points, trust_score_after, issued_at, acknowledged_at
           FROM Session_Warnings
          WHERE session_id = ?
          ORDER BY warning_id ASC`,
        [sessionId]
      );

      sendSuccess(res, rows);
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
          extensionRequest: session.extension_request ?? null,
        });
        return;
      }

      await executeSql('UPDATE Exam_Sessions SET last_heartbeat_at = NOW() WHERE id = ?', [
        sessionId,
      ]);

      const refreshed = await assertSessionAccess(sessionId, req.user);
      const remaining = Number(refreshed.seconds_remaining ?? 0);

      if (remaining <= 0 && refreshed.status === 'IN_PROGRESS') {
        const maxExt = Number(refreshed.max_extension_mins ?? 0);
        const extReq = refreshed.extension_request;

        // If an extension request is pending:
        if (extReq && extReq.status === 'PENDING') {
          const [ageRows] = await queryRows<RowDataPacket[]>(
            `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_secs
               FROM Time_Extension_Requests
              WHERE request_id = ? LIMIT 1`,
            [extReq.request_id]
          );
          const ageSecs = Number(ageRows[0]?.age_secs ?? 0);
          if (ageSecs < 180) {
            // Still pending and unexpired: answers locked, don't auto-timeout
            sendSuccess(res, {
              sessionId,
              status: refreshed.status,
              trustScore: refreshed.trust_score,
              secondsRemaining: 0,
              extensionPending: true,
              extensionRequest: extReq,
            });
            return;
          }
          // Expired (>= 180s): mark expired
          await executeSql(
            "UPDATE Time_Extension_Requests SET status = 'EXPIRED' WHERE request_id = ?",
            [extReq.request_id]
          );
        } else if (maxExt > 0 && !extReq) {
          // No extension request made yet and extensions are permitted:
          // Give grace window from deadline for student to interact with modal
          const graceSecs = env.EXTENSION_GRACE_SECONDS ?? 180;
          const [overdueRows] = await queryRows<RowDataPacket[]>(
            `SELECT TIMESTAMPDIFF(SECOND, server_deadline, NOW()) AS overdue_secs
               FROM Exam_Sessions WHERE id = ? LIMIT 1`,
            [sessionId]
          );
          const overdueSecs = Number(overdueRows[0]?.overdue_secs ?? 0);
          if (overdueSecs <= graceSecs) {
            sendSuccess(res, {
              sessionId,
              status: refreshed.status,
              trustScore: refreshed.trust_score,
              secondsRemaining: 0,
              inGraceWindow: true,
              graceSecondsRemaining: Math.max(0, graceSecs - overdueSecs),
              extensionEligible: true,
              extensionRequest: null,
            });
            return;
          }
        }

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
        secondsRemaining: remaining,
        extensionRequest: refreshed.extension_request ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

const requestExtensionSchema = z.object({
  requestedMinutes: z.coerce.number().int().min(1, 'Requested minutes must be at least 1').max(120, 'Requested minutes cannot exceed 120'),
  reason: z.string().trim().max(255, 'Reason cannot exceed 255 characters').optional().nullable(),
});

// POST /api/sessions/:sessionId/extension (STUDENT)
sessionsRouter.post(
  '/:sessionId/extension',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: sessionIdParamSchema, body: requestExtensionSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    const connection = await pool.getConnection();
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const body = req.body as z.infer<typeof requestExtensionSchema>;
      const graceSeconds = env.EXTENSION_GRACE_SECONDS ?? 180;

      await connection.beginTransaction();

      // Row-lock session to prevent race condition with cron or submit
      const [sessRows] = await connection.query<ExamSessionRow[]>(
        `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.min_trust_score, e.max_extension_mins,
                GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
                TIMESTAMPDIFF(SECOND, es.server_deadline, NOW()) AS seconds_overdue
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?
          FOR UPDATE`,
        [sessionId]
      );

      const session = sessRows[0];
      if (!session) {
        await connection.rollback();
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found.');
      }

      if (req.user!.role === 'STUDENT' && session.student_id !== req.user!.sub) {
        await connection.rollback();
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this exam session.');
      }

      // Specific terminal/non-in-progress status error handling
      if (session.status === 'TIMED_OUT') {
        await connection.rollback();
        throw new AppError(
          400,
          'SESSION_TIMED_OUT',
          'Your exam session has already timed out. Time extensions can no longer be requested.'
        );
      }
      if (session.status === 'SUBMITTED') {
        await connection.rollback();
        throw new AppError(
          400,
          'SESSION_ALREADY_SUBMITTED',
          'Your exam session has already been submitted.'
        );
      }
      if (session.status === 'TERMINATED_CHEATING') {
        await connection.rollback();
        throw new AppError(
          400,
          'SESSION_TERMINATED',
          'Exam session terminated due to proctoring violation. Extensions are prohibited.'
        );
      }
      if (session.status !== 'IN_PROGRESS') {
        await connection.rollback();
        throw new AppError(
          400,
          'SESSION_NOT_IN_PROGRESS',
          `Cannot request time extension for an exam that is not in progress (current status: ${session.status}).`
        );
      }

      const maxExt = Number(session.max_extension_mins ?? 30);
      if (maxExt <= 0) {
        await connection.rollback();
        throw new AppError(400, 'EXTENSIONS_DISABLED', 'Time extensions are not permitted for this examination.');
      }

      if (body.requestedMinutes > maxExt) {
        await connection.rollback();
        throw new AppError(
          400,
          'EXCEEDS_MAX_EXTENSION',
          `Requested extension (${body.requestedMinutes}m) exceeds the maximum allowed extension of ${maxExt}m.`
        );
      }

      // Extension window check: remaining <= 10 mins (600s) OR within grace window (overdue <= graceSeconds)
      const remainingSecs = Number(session.seconds_remaining ?? 0);
      const overdueSecs = Number(session.seconds_overdue ?? 0);
      const inGrace = overdueSecs >= 0 && overdueSecs <= graceSeconds;
      const eligibleByTime = remainingSecs <= 600 || inGrace;

      if (!eligibleByTime) {
        await connection.rollback();
        throw new AppError(
          400,
          'NOT_ELIGIBLE_FOR_EXTENSION',
          'Time extension can only be requested when 10 minutes or less remain, or during the grace window.'
        );
      }

      // Check existing extension request row-locked
      const [extRows] = await connection.query<TimeExtensionRequestRow[]>(
        `SELECT request_id, status FROM Time_Extension_Requests WHERE session_id = ? FOR UPDATE`,
        [sessionId]
      );
      if (extRows.length > 0) {
        await connection.rollback();
        throw new AppError(
          409,
          'EXTENSION_ALREADY_REQUESTED',
          'An extension request has already been submitted for this exam session.'
        );
      }

      const reasonText = body.reason?.trim() || null;
      const [insertRes] = await connection.query<ResultSetHeader>(
        `INSERT INTO Time_Extension_Requests (session_id, requested_minutes, reason, status)
         VALUES (?, ?, ?, 'PENDING')`,
        [sessionId, body.requestedMinutes, reasonText]
      );
      const requestId = insertRes.insertId;

      if (overdueSecs >= 0 && !session.time_expired_at) {
        await connection.query(
          `UPDATE Exam_Sessions SET time_expired_at = COALESCE(time_expired_at, server_deadline, NOW()) WHERE id = ?`,
          [sessionId]
        );
      }

      await connection.commit();

      const userEmail = req.user!.email;
      const userName = req.user!.fullName;

      emitExtensionRequested({
        requestId,
        sessionId,
        studentId: session.student_id,
        studentName: userName,
        studentEmail: userEmail,
        examId: session.exam_id,
        examTitle: session.exam_title,
        trustScore: session.trust_score,
        requestedMinutes: body.requestedMinutes,
        reason: reasonText,
        createdAt: new Date().toISOString(),
        inGraceWindow: inGrace,
      });

      sendSuccess(
        res,
        {
          requestId,
          sessionId,
          requestedMinutes: body.requestedMinutes,
          reason: reasonText,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          inGraceWindow: inGrace,
        },
        201
      );
    } catch (err) {
      await connection.rollback().catch(() => {});
      next(err);
    } finally {
      connection.release();
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

      // Expire pending extension request if submitting
      await executeSql(
        "UPDATE Time_Extension_Requests SET status = 'EXPIRED' WHERE session_id = ? AND status = 'PENDING'",
        [sessionId]
      );

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

      // QA Fix (Sub-Phase 11.3): Return result payload directly and with result property alias
      sendSuccess(res, { ...(result ?? {}), result });
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

      const extensions = await queryRows<RowDataPacket[]>(
        `SELECT ter.*, u.full_name AS decided_by_name
           FROM Time_Extension_Requests ter
           LEFT JOIN Users u ON u.id = ter.decided_by
          WHERE ter.session_id = ?
          ORDER BY ter.created_at ASC`,
        [sessionId]
      );

      sendSuccess(res, {
        session: monitors[0],
        timeline: logs,
        extensions,
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
