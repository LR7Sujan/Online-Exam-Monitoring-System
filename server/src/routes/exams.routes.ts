import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, queryRows, withConnection } from '../config/db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitSessionUpdate } from '../realtime/socket.js';
import type { ExamRow, ExamSessionRow, QuestionRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const examsRouter = Router();

const examIdParamSchema = z.object({
  examId: z.coerce.number().int().positive(),
});

const questionIdParamSchema = z.object({
  examId: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
});

const questionInputSchema = z
  .object({
    questionText: z.string().trim().min(1, 'Question prompt is required').max(4000),
    optionA: z.string().trim().min(1, 'Option A is required').max(500),
    optionB: z.string().trim().min(1, 'Option B is required').max(500),
    optionC: z.string().trim().max(500).optional().default('N/A'),
    optionD: z.string().trim().max(500).optional().default('N/A'),
    correctOption: z.enum(['A', 'B', 'C', 'D'], {
      errorMap: () => ({ message: 'Correct option must be A, B, C, or D' }),
    }),
    marks: z.coerce.number().positive('Marks must be greater than 0').max(1000).default(1),
    orderIndex: z.coerce.number().int().positive().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.correctOption === 'C' && (!q.optionC || q.optionC.trim() === '' || q.optionC === 'N/A')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct option C points to an empty option',
        path: ['correctOption'],
      });
    }
    if (q.correctOption === 'D' && (!q.optionD || q.optionD.trim() === '' || q.optionD === 'N/A')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct option D points to an empty option',
        path: ['correctOption'],
      });
    }
  });

const createQuestionSchema = questionInputSchema;

const updateQuestionSchema = z
  .object({
    questionText: z.string().trim().min(1, 'Question prompt is required').max(4000).optional(),
    optionA: z.string().trim().min(1, 'Option A is required').max(500).optional(),
    optionB: z.string().trim().min(1, 'Option B is required').max(500).optional(),
    optionC: z.string().trim().max(500).optional(),
    optionD: z.string().trim().max(500).optional(),
    correctOption: z.enum(['A', 'B', 'C', 'D']).optional(),
    marks: z.coerce.number().positive('Marks must be greater than 0').max(1000).optional(),
    negativeMarks: z.coerce.number().min(0).max(1000).optional(),
    orderIndex: z.coerce.number().int().positive().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.correctOption === 'C' && q.optionC !== undefined && (q.optionC.trim() === '' || q.optionC === 'N/A')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct option C points to an empty option',
        path: ['correctOption'],
      });
    }
    if (q.correctOption === 'D' && q.optionD !== undefined && (q.optionD.trim() === '' || q.optionD === 'N/A')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct option D points to an empty option',
        path: ['correctOption'],
      });
    }
  });

const createExamSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    durationMinutes: z.coerce.number().int().min(1, 'Duration must be between 1 and 600 minutes').max(600, 'Duration must be between 1 and 600 minutes').default(60),
    minTrustScore: z.coerce.number().int().min(0, 'Minimum trust score must be between 0 and 100').max(100, 'Minimum trust score must be between 0 and 100').default(50),
    maxExtensionMins: z.coerce.number().int().min(0, 'Max extra time must be between 0 and 120 minutes').max(120, 'Max extra time must be between 0 and 120 minutes').default(30),
    startWindow: z.string().optional(),
    endWindow: z.string().optional(),
    isPublished: z.boolean().default(false),
    questions: z.array(questionInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isPublished) {
      if (!data.description || data.description.trim().length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Syllabus & instructions are required and must be at least 20 characters',
          path: ['description'],
        });
      }
      if (!data.startWindow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start window is required',
          path: ['startWindow'],
        });
      }
      if (!data.endWindow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End window is required',
          path: ['endWindow'],
        });
      }
      if (data.startWindow && data.endWindow) {
        const start = new Date(data.startWindow).getTime();
        const end = new Date(data.endWindow).getTime();
        if (Number.isNaN(start)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid start window date format',
            path: ['startWindow'],
          });
        }
        if (Number.isNaN(end)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid end window date format',
            path: ['endWindow'],
          });
        }
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          if (end <= start) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'End window must be after start window',
              path: ['endWindow'],
            });
          } else {
            const windowMinutes = (end - start) / (60 * 1000);
            if (windowMinutes < data.durationMinutes) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Window duration (${Math.round(windowMinutes)} mins) must be at least equal to exam duration (${data.durationMinutes} mins)`,
                path: ['endWindow'],
              });
            }
          }
        }
      }
      if (!data.questions || data.questions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least 1 question is required to publish an exam',
          path: ['questions'],
        });
      }
    }
  });

const updateExamSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    durationMinutes: z.coerce.number().int().min(1, 'Duration must be between 1 and 600 minutes').max(600, 'Duration must be between 1 and 600 minutes').optional(),
    minTrustScore: z.coerce.number().int().min(0, 'Minimum trust score must be between 0 and 100').max(100, 'Minimum trust score must be between 0 and 100').optional(),
    maxExtensionMins: z.coerce.number().int().min(0, 'Max extra time must be between 0 and 120 minutes').max(120, 'Max extra time must be between 0 and 120 minutes').optional(),
    startWindow: z.string().optional(),
    endWindow: z.string().optional(),
    isPublished: z.boolean().optional(),
    questions: z.array(questionInputSchema).optional(),
  });

const startExamBodySchema = z
  .object({
    deviceFingerprint: z.string().trim().min(1).max(255).optional(),
    sessionToken: z.string().trim().min(1).max(128).optional(),
  })
  .optional()
  .default({});

function toMysqlDateTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'INVALID_DATETIME', `Invalid datetime format: ${input}`);
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket.remoteAddress || '0.0.0.0').slice(0, 64);
}

export async function startOrResumeExamSession(params: {
  examId: number;
  studentId: number;
  studentName: string;
  ipAddress: string;
  deviceFingerprint: string;
  sessionToken?: string;
}): Promise<{ session: ExamSessionRow; created: boolean }> {
  return withConnection(async (conn) => {
    await conn.beginTransaction();
    try {
      const [examRows] = await conn.execute<ExamRow[]>(
        `SELECT id, title, duration_minutes, min_trust_score, start_window, end_window,
                is_published, (NOW() BETWEEN start_window AND end_window) AS window_open
           FROM Exams
          WHERE id = ?
          LIMIT 1`,
        [params.examId]
      );
      const exam = examRows[0] as (ExamRow & { window_open: number }) | undefined;
      if (!exam) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }
      if (!exam.is_published) {
        throw new AppError(403, 'EXAM_UNPUBLISHED', 'This exam is not published.');
      }

      const [existingRows] = await conn.execute<ExamSessionRow[]>(
        `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.min_trust_score,
                GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.exam_id = ? AND es.student_id = ?
          FOR UPDATE`,
        [params.examId, params.studentId]
      );

      const existing = existingRows[0];
      if (existing) {
        if (existing.status !== 'IN_PROGRESS') {
          throw new AppError(
            409,
            'SESSION_ALREADY_CLOSED',
            `Exam session already ended with status ${existing.status}.`
          );
        }

        const storedToken = existing.session_token ?? '';
        const storedFingerprint = existing.device_fingerprint ?? '';

        // QA Fix (Sub-Phase 11.3): Prevent cross-device hijack; allow same-device resume
        if (
          params.deviceFingerprint &&
          storedFingerprint &&
          params.deviceFingerprint !== storedFingerprint
        ) {
          throw new AppError(
            409,
            'SESSION_CONFLICT',
            'Active exam session already exists with a mismatched device_fingerprint.'
          );
        }

        if (
          params.sessionToken &&
          storedToken &&
          params.sessionToken !== storedToken
        ) {
          throw new AppError(
            409,
            'SESSION_CONFLICT',
            'Active exam session already exists with a mismatched session_token.'
          );
        }

        await conn.commit();
        return { session: existing, created: false };
      }

      if (!exam.window_open) {
        throw new AppError(
          409,
          'EXAM_WINDOW_CLOSED',
          'Current server time is outside the exam start_window and end_window.'
        );
      }

      // QA Fix (Sub-Phase 11.3): Retain client-provided session token if supplied, else generate random token
      const newToken = params.sessionToken || randomBytes(32).toString('hex');
      const [insertRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Exam_Sessions
           (exam_id, student_id, trust_score, status, started_at, server_deadline, last_heartbeat_at,
            ip_address, device_fingerprint, session_token)
         VALUES
           (?, ?, 100, 'IN_PROGRESS', NOW(),
            LEAST(?, DATE_ADD(NOW(), INTERVAL ? MINUTE)),
            NOW(), ?, ?, ?)`,
        [
          params.examId,
          params.studentId,
          exam.end_window,
          exam.duration_minutes,
          params.ipAddress,
          params.deviceFingerprint,
          newToken,
        ]
      );

      const [createdRows] = await conn.execute<ExamSessionRow[]>(
        `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.min_trust_score, e.max_extension_mins,
                GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?
          LIMIT 1`,
        [insertRes.insertId]
      );

      await conn.commit();
      return { session: createdRows[0], created: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  });
}

// GET /api/exams/available (STUDENT — must be defined BEFORE /:examId)
examsRouter.get(
  '/available',
  requireAuth,
  requireRole('STUDENT'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const rows = await queryRows<RowDataPacket[]>(
        `SELECT
           e.id, e.title, e.description, e.duration_minutes, e.min_trust_score, e.max_extension_mins,
           e.start_window, e.end_window, e.is_published,
           (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.id) AS question_count,
           (SELECT COALESCE(SUM(q.marks), 0) FROM Questions q WHERE q.exam_id = e.id) AS total_marks,
           es.id AS session_id,
           es.status AS session_status,
           es.trust_score AS session_trust_score,
           es.server_deadline AS session_deadline,
           (NOW() BETWEEN e.start_window AND e.end_window) AS is_window_open
         FROM Exams e
         LEFT JOIN Exam_Sessions es
           ON es.exam_id = e.id AND es.student_id = ?
         WHERE e.is_published = TRUE
         ORDER BY e.start_window ASC, e.id DESC`,
        [req.user!.sub]
      );
      sendSuccess(res, rows);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/exams
examsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
    if (user.role === 'STUDENT') {
      const rows = await queryRows<RowDataPacket[]>(
        `SELECT
           e.id, e.title, e.description, e.duration_minutes, e.min_trust_score, e.max_extension_mins,
           e.start_window, e.end_window, e.is_published,
           (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.id) AS question_count,
           (SELECT COALESCE(SUM(q.marks), 0) FROM Questions q WHERE q.exam_id = e.id) AS total_marks,
           es.id AS session_id,
           es.status AS session_status,
           es.trust_score AS session_trust_score,
           es.server_deadline AS session_deadline,
           (NOW() BETWEEN e.start_window AND e.end_window) AS is_window_open
         FROM Exams e
         LEFT JOIN Exam_Sessions es
           ON es.exam_id = e.id AND es.student_id = ?
         WHERE e.is_published = TRUE
         ORDER BY e.start_window ASC, e.id DESC`,
        [user.sub]
      );
      sendSuccess(res, rows);
      return;
    }

    const rows = await queryRows<RowDataPacket[]>(
      `SELECT
         e.id, e.title, e.description, e.duration_minutes, e.min_trust_score, e.max_extension_mins,
         e.start_window, e.end_window, e.is_published, e.created_by, e.created_at,
         u.full_name AS creator_name,
         (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.id) AS question_count,
         (SELECT COALESCE(SUM(q.marks), 0) FROM Questions q WHERE q.exam_id = e.id) AS total_marks,
         (SELECT COUNT(*) FROM Exam_Sessions es WHERE es.exam_id = e.id) AS total_sessions,
         (SELECT COUNT(*) FROM Exam_Sessions es WHERE es.exam_id = e.id AND es.status = 'IN_PROGRESS') AS active_sessions
       FROM Exams e
       JOIN Users u ON u.id = e.created_by
       ORDER BY e.created_at DESC`
    );
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/exams/:examId
examsRouter.get(
  '/:examId',
  requireAuth,
  validate({ params: examIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const exams = await queryRows<ExamRow[]>(
        `SELECT id, title, description, duration_minutes, min_trust_score, max_extension_mins,
                start_window, end_window, is_published, created_by, created_at
           FROM Exams
          WHERE id = ?
          LIMIT 1`,
        [examId]
      );
      const exam = exams[0];
      if (!exam) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }

      if (req.user!.role === 'STUDENT') {
        if (!exam.is_published) {
          throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
        }
        sendSuccess(res, { exam });
        return;
      }

      const questions = await queryRows<QuestionRow[]>(
        `SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d,
                correct_option, marks, order_index
           FROM Questions
          WHERE exam_id = ?
          ORDER BY order_index ASC, id ASC`,
        [examId]
      );

      const creatorRows = await queryRows<RowDataPacket[]>(
        'SELECT id, full_name, email FROM Users WHERE id = ? LIMIT 1',
        [exam.created_by]
      );
      const creator = creatorRows[0] || {
        id: exam.created_by,
        full_name: 'Administrator',
        email: 'admin@proctoriq.io',
      };

      const statsRows = await queryRows<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total_sessions,
           SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_sessions,
           SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS completed_sessions,
           SUM(CASE WHEN status = 'TERMINATED_CHEATING' THEN 1 ELSE 0 END) AS disqualified_sessions,
           SUM(CASE WHEN status = 'TIMED_OUT' THEN 1 ELSE 0 END) AS timed_out_sessions
         FROM Exam_Sessions
         WHERE exam_id = ?`,
        [examId]
      );

      const stats = {
        totalSessions: Number(statsRows[0]?.total_sessions ?? 0),
        inProgressSessions: Number(statsRows[0]?.in_progress_sessions ?? 0),
        completedSessions: Number(statsRows[0]?.completed_sessions ?? 0),
        disqualifiedSessions: Number(statsRows[0]?.disqualified_sessions ?? 0),
        timedOutSessions: Number(statsRows[0]?.timed_out_sessions ?? 0),
        questionCount: questions.length,
        totalMarks: questions.reduce((sum, q) => sum + Number(q.marks || 0), 0),
      };

      sendSuccess(res, { exam, creator, stats, questions });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/exams (ADMIN)
examsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createExamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof createExamSchema>;
      const startWin = body.startWindow
        ? toMysqlDateTime(body.startWindow)
        : toMysqlDateTime(new Date().toISOString());
      const endWin = body.endWindow
        ? toMysqlDateTime(body.endWindow)
        : toMysqlDateTime(new Date(Date.now() + 7 * 86400000).toISOString());

      const exam = await withConnection(async (conn) => {
        await conn.beginTransaction();
        try {
          const [result] = await conn.execute<ResultSetHeader>(
            `INSERT INTO Exams
              (title, description, duration_minutes, min_trust_score, max_extension_mins, start_window, end_window, is_published, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              body.title,
              body.description ?? null,
              body.durationMinutes ?? 60,
              body.minTrustScore ?? 50,
              body.maxExtensionMins ?? 30,
              startWin,
              endWin,
              Boolean(body.isPublished),
              req.user!.sub,
            ]
          );

          const examId = result.insertId;

          if (body.questions && body.questions.length > 0) {
            let orderIdx = 1;
            for (const q of body.questions) {
              await conn.execute(
                `INSERT INTO Questions
                  (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  examId,
                  q.questionText,
                  q.optionA,
                  q.optionB,
                  q.optionC || 'N/A',
                  q.optionD || 'N/A',
                  q.correctOption,
                  q.marks ?? 1,
                  q.orderIndex ?? orderIdx++,
                ]
              );
            }
          }

          const [rows] = await conn.execute<ExamRow[]>(
            'SELECT * FROM Exams WHERE id = ? LIMIT 1',
            [examId]
          );

          await conn.commit();
          return rows[0];
        } catch (e) {
          await conn.rollback();
          throw e;
        }
      });

      sendSuccess(res, exam, 201);
    } catch (err) {
      next(err);
    }
  }
);

async function handleUpdateExam(req: AuthenticatedRequest, res: Parameters<typeof sendSuccess>[0], next: (e?: unknown) => void) {
  try {
    const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
    const body = req.body as z.infer<typeof updateExamSchema>;

    const existingRows = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [
      examId,
    ]);
    const existing = existingRows[0];
    if (!existing) {
      throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    }

    const startWin = body.startWindow ? toMysqlDateTime(body.startWindow) : existing.start_window;
    const endWin = body.endWindow ? toMysqlDateTime(body.endWindow) : existing.end_window;
    const targetPublished = body.isPublished !== undefined ? body.isPublished : Boolean(existing.is_published);

    if (existing.is_published) {
      if (targetPublished === false) {
        const activeSessions = await queryRows<RowDataPacket[]>(
          "SELECT id, student_id FROM Exam_Sessions WHERE exam_id = ? AND status = 'IN_PROGRESS'",
          [examId]
        );
        if (activeSessions.length > 0) {
          throw new AppError(
            409,
            'ACTIVE_SESSIONS_IN_PROGRESS',
            `Cannot unpublish exam while ${activeSessions.length} student session(s) are currently IN_PROGRESS. Please wait for sessions to conclude or terminate them first.`
          );
        }
      } else {
        const isEditingContent =
          (body.title !== undefined && body.title.trim() !== existing.title) ||
          (body.description !== undefined && (body.description?.trim() ?? '') !== (existing.description ?? '')) ||
          (body.durationMinutes !== undefined && body.durationMinutes !== existing.duration_minutes) ||
          (body.minTrustScore !== undefined && body.minTrustScore !== existing.min_trust_score) ||
          (body.maxExtensionMins !== undefined && body.maxExtensionMins !== existing.max_extension_mins) ||
          (body.startWindow !== undefined && new Date(body.startWindow).getTime() !== new Date(existing.start_window).getTime()) ||
          (body.endWindow !== undefined && new Date(body.endWindow).getTime() !== new Date(existing.end_window).getTime()) ||
          (body.questions && body.questions.length > 0);

        if (isEditingContent) {
          throw new AppError(
            409,
            'EXAM_PUBLISHED',
            'Cannot modify parameters or questions of a published exam. Unpublish the exam first.'
          );
        }
      }
    }

    if (targetPublished) {
      const finalTitle = (body.title ?? existing.title).trim();
      const finalDesc = (body.description !== undefined ? body.description : existing.description)?.trim() ?? '';
      const finalDuration = body.durationMinutes ?? existing.duration_minutes;
      const finalTrust = body.minTrustScore ?? existing.min_trust_score;

      const errors: Record<string, string[]> = {};
      if (!finalTitle) {
        errors.title = ['Title is required'];
      }
      if (!finalDesc || finalDesc.length < 20) {
        errors.description = ['Syllabus & instructions are required and must be at least 20 characters'];
      }
      if (!finalDuration || finalDuration < 1 || finalDuration > 600) {
        errors.durationMinutes = ['Duration must be between 1 and 600 minutes'];
      }
      const sTime = new Date(startWin).getTime();
      const eTime = new Date(endWin).getTime();
      if (Number.isNaN(sTime) || Number.isNaN(eTime)) {
        errors.window = ['Valid start and end window timestamps are required'];
      } else {
        if (eTime <= sTime) {
          errors.endWindow = ['End window must be after start window'];
        } else {
          const winMins = (eTime - sTime) / (60 * 1000);
          if (winMins < finalDuration) {
            errors.endWindow = [`Window duration (${Math.round(winMins)} mins) must be at least equal to exam duration (${finalDuration} mins)`];
          }
        }
      }
      if (finalTrust < 0 || finalTrust > 100) {
        errors.minTrustScore = ['Minimum trust score must be between 0 and 100'];
      }

      const qRows = await queryRows<RowDataPacket[]>('SELECT COUNT(*) AS count FROM Questions WHERE exam_id = ?', [examId]);
      const currentQCount = Number(qRows[0]?.count ?? 0);
      const newQCount = body.questions ? body.questions.length : 0;
      if (currentQCount + newQCount === 0) {
        errors.questions = ['At least 1 question is required to publish an exam'];
      }

      if (Object.keys(errors).length > 0) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Exam cannot be published with missing requirements.', { fieldErrors: errors });
        return;
      }
    }

    await withConnection(async (conn) => {
      await conn.beginTransaction();
      try {
        await conn.execute(
          `UPDATE Exams
              SET title = ?,
                  description = ?,
                  duration_minutes = ?,
                  min_trust_score = ?,
                  max_extension_mins = ?,
                  start_window = ?,
                  end_window = ?,
                  is_published = ?
            WHERE id = ?`,
          [
            body.title ?? existing.title,
            body.description !== undefined ? body.description : existing.description,
            body.durationMinutes ?? existing.duration_minutes,
            body.minTrustScore ?? existing.min_trust_score,
            body.maxExtensionMins !== undefined ? body.maxExtensionMins : existing.max_extension_mins,
            startWin,
            endWin,
            targetPublished,
            examId,
          ]
        );

        if (body.questions && body.questions.length > 0) {
          const [orderRows] = await conn.execute<RowDataPacket[]>(
            'SELECT COALESCE(MAX(order_index), 0) AS max_order FROM Questions WHERE exam_id = ?',
            [examId]
          );
          let nextOrder = Number(orderRows[0]?.max_order ?? 0) + 1;
          for (const q of body.questions) {
            await conn.execute(
              `INSERT INTO Questions
                (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                examId,
                q.questionText,
                q.optionA,
                q.optionB,
                q.optionC || 'N/A',
                q.optionD || 'N/A',
                q.correctOption,
                q.marks ?? 1,
                q.orderIndex ?? nextOrder++,
              ]
            );
          }
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      }
    });

    const updated = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [
      examId,
    ]);
    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
}

// Publish Exam Handler
async function handlePublishExam(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;

    const existingRows = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [
      examId,
    ]);
    const exam = existingRows[0];
    if (!exam) {
      throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    }

    const errors: Record<string, string[]> = {};
    if (!exam.title || exam.title.trim().length === 0) {
      errors.title = ['Title is required'];
    }
    if (!exam.description || exam.description.trim().length < 20) {
      errors.description = ['Syllabus & instructions are required and must be at least 20 characters'];
    }
    if (!exam.duration_minutes || exam.duration_minutes < 1 || exam.duration_minutes > 600) {
      errors.durationMinutes = ['Duration must be between 1 and 600 minutes'];
    }

    const sTime = new Date(exam.start_window).getTime();
    const eTime = new Date(exam.end_window).getTime();
    if (Number.isNaN(sTime) || Number.isNaN(eTime)) {
      errors.window = ['Valid start and end window timestamps are required'];
    } else {
      if (eTime <= sTime) {
        errors.endWindow = ['End window must be after start window'];
      } else {
        const winMins = (eTime - sTime) / (60 * 1000);
        if (winMins < exam.duration_minutes) {
          errors.endWindow = [`Window duration (${Math.round(winMins)} mins) must be at least equal to exam duration (${exam.duration_minutes} mins)`];
        }
      }
    }

    if (exam.min_trust_score < 0 || exam.min_trust_score > 100) {
      errors.minTrustScore = ['Minimum trust score must be between 0 and 100'];
    }

    const questions = await queryRows<QuestionRow[]>(
      'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, marks FROM Questions WHERE exam_id = ?',
      [examId]
    );

    if (questions.length === 0) {
      errors.questions = ['At least 1 question is required to publish an exam'];
    } else {
      for (const q of questions) {
        if (!q.question_text || !q.option_a || !q.option_b || Number(q.marks) <= 0) {
          errors.questions = ['All questions must have question prompt, options A & B, and marks > 0'];
          break;
        }
        if (q.correct_option === 'C' && (!q.option_c || q.option_c.trim() === '' || q.option_c === 'N/A')) {
          errors.questions = ['Question contains correct option C pointing to an empty option'];
          break;
        }
        if (q.correct_option === 'D' && (!q.option_d || q.option_d.trim() === '' || q.option_d === 'N/A')) {
          errors.questions = ['Question contains correct option D pointing to an empty option'];
          break;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Exam cannot be published with missing requirements.', { fieldErrors: errors });
      return;
    }

    await executeSql('UPDATE Exams SET is_published = TRUE WHERE id = ?', [examId]);
    const updated = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [examId]);
    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
}

// Unpublish Exam Handler
async function handleUnpublishExam(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
    const existingRows = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [
      examId,
    ]);
    const exam = existingRows[0];
    if (!exam) {
      throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    }

    const activeSessions = await queryRows<RowDataPacket[]>(
      "SELECT id, student_id FROM Exam_Sessions WHERE exam_id = ? AND status = 'IN_PROGRESS'",
      [examId]
    );
    if (activeSessions.length > 0) {
      throw new AppError(
        409,
        'ACTIVE_SESSIONS_IN_PROGRESS',
        `Cannot unpublish exam while ${activeSessions.length} student session(s) are currently IN_PROGRESS. Please wait for sessions to conclude or terminate them first.`
      );
    }

    await executeSql('UPDATE Exams SET is_published = FALSE WHERE id = ?', [examId]);
    const updated = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [examId]);
    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
}

// PATCH & POST /api/exams/:examId/publish (ADMIN)
examsRouter.patch(
  '/:examId/publish',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema }),
  handlePublishExam
);

examsRouter.post(
  '/:examId/publish',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema }),
  handlePublishExam
);

// PATCH & POST /api/exams/:examId/unpublish (ADMIN)
examsRouter.patch(
  '/:examId/unpublish',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema }),
  handleUnpublishExam
);

examsRouter.post(
  '/:examId/unpublish',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema }),
  handleUnpublishExam
);

// PUT & PATCH /api/exams/:examId (ADMIN)
examsRouter.put(
  '/:examId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema, body: updateExamSchema }),
  handleUpdateExam
);

examsRouter.patch(
  '/:examId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema, body: updateExamSchema }),
  handleUpdateExam
);

// DELETE /api/exams/:examId (ADMIN)
examsRouter.delete(
  '/:examId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema }),
  async (req, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const existingRows = await queryRows<ExamRow[]>('SELECT id, title, is_published FROM Exams WHERE id = ? LIMIT 1', [examId]);
      const exam = existingRows[0];
      if (!exam) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }

      if (exam.is_published) {
        throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot delete a published exam. Unpublish it first or archive it.');
      }

      const sessionCountRows = await queryRows<RowDataPacket[]>(
        'SELECT COUNT(*) AS count FROM Exam_Sessions WHERE exam_id = ?',
        [examId]
      );
      const sessionCount = Number(sessionCountRows[0]?.count ?? 0);
      if (sessionCount > 0) {
        throw new AppError(
          409,
          'AUDIT_DATA_EXISTS',
          'This exam cannot be deleted because audit records and exam sessions exist in the system. The forensic audit trail must remain intact.'
        );
      }

      await executeSql('DELETE FROM Questions WHERE exam_id = ?', [examId]);
      const result = await executeSql('DELETE FROM Exams WHERE id = ?', [examId]);
      if (result.affectedRows === 0) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }
      sendSuccess(res, { deleted: true, examId });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/exams/:examId/start (STUDENT)
examsRouter.post(
  '/:examId/start',
  requireAuth,
  requireRole('STUDENT'),
  validate({ params: examIdParamSchema, body: startExamBodySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const body = req.body as z.infer<typeof startExamBodySchema>;
      const fingerprint =
        body.deviceFingerprint ||
        (typeof req.headers['x-device-fingerprint'] === 'string'
          ? req.headers['x-device-fingerprint'].slice(0, 255)
          : (req.headers['user-agent'] ?? 'unknown-device').slice(0, 255));
      const tokenHeader =
        typeof req.headers['x-session-token'] === 'string'
          ? req.headers['x-session-token']
          : undefined;

      const { session, created } = await startOrResumeExamSession({
        examId,
        studentId: req.user!.sub,
        studentName: req.user!.fullName,
        ipAddress: extractClientIp(req),
        deviceFingerprint: fingerprint,
        sessionToken: body.sessionToken ?? tokenHeader,
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

// GET /api/exams/:examId/questions (ADMIN / PROCTOR)
examsRouter.get(
  '/:examId/questions',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: examIdParamSchema }),
  async (req, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const questions = await queryRows<QuestionRow[]>(
        `SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d,
                correct_option, marks, order_index
           FROM Questions
          WHERE exam_id = ?
          ORDER BY order_index ASC, id ASC`,
        [examId]
      );
      sendSuccess(res, questions);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/exams/:examId/questions (ADMIN)
examsRouter.post(
  '/:examId/questions',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema, body: createQuestionSchema }),
  async (req, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const body = req.body as z.infer<typeof createQuestionSchema>;

      const exams = await queryRows<ExamRow[]>('SELECT id, is_published FROM Exams WHERE id = ? LIMIT 1', [
        examId,
      ]);
      if (!exams[0]) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }
      if (exams[0].is_published) {
        throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot modify questions of a published exam. Unpublish the exam first.');
      }

      const orderRows = await queryRows<RowDataPacket[]>(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM Questions WHERE exam_id = ?',
        [examId]
      );
      const nextOrder = body.orderIndex ?? Number(orderRows[0]?.next_order ?? 1);

      const result = await executeSql(
        `INSERT INTO Questions
          (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examId,
          body.questionText,
          body.optionA,
          body.optionB,
          body.optionC || 'N/A',
          body.optionD || 'N/A',
          body.correctOption,
          body.marks,
          nextOrder,
        ]
      );

      const created = await queryRows<QuestionRow[]>(
        'SELECT * FROM Questions WHERE id = ? LIMIT 1',
        [result.insertId]
      );
      sendSuccess(res, created[0], 201);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/exams/:examId/questions/bulk (ADMIN) — bulk CSV question import
examsRouter.post(
  '/:examId/questions/bulk',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema }),
  async (req, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const { questions } = req.body as {
        questions: Array<{
          questionText: string;
          optionA: string;
          optionB: string;
          optionC: string;
          optionD: string;
          correctOption: 'A' | 'B' | 'C' | 'D';
          marks?: number;
        }>;
      };

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new AppError(400, 'INVALID_BODY', 'Array of questions is required');
      }

      const exams = await queryRows<ExamRow[]>('SELECT id, is_published FROM Exams WHERE id = ? LIMIT 1', [examId]);
      if (!exams[0]) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }
      if (exams[0].is_published) {
        throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot modify questions of a published exam. Unpublish the exam first.');
      }

      const orderRows = await queryRows<RowDataPacket[]>(
        'SELECT COALESCE(MAX(order_index), 0) AS max_order FROM Questions WHERE exam_id = ?',
        [examId]
      );
      let nextOrder = Number(orderRows[0]?.max_order ?? 0) + 1;

      const insertedIds: number[] = [];
      const qList = questions as Array<Record<string, unknown>>;
      if (qList.length > 0) {
        const valuesClause: string[] = [];
        const params: (string | number)[] = [];

        for (const q of qList) {
          const text = String(q.questionText || q.question_text || '');
          const optA = String(q.optionA || q.option_a || '');
          const optB = String(q.optionB || q.option_b || '');
          const optC = String(q.optionC || q.option_c || '');
          const optD = String(q.optionD || q.option_d || '');
          const correct = String(q.correctOption || q.correct_option || 'A').toUpperCase();
          const marks = Number(q.marks ?? 1);

          valuesClause.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
          params.push(examId, text, optA, optB, optC, optD, correct, marks, nextOrder++);
        }

        const res = await executeSql(
          `INSERT INTO Questions
            (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
           VALUES ${valuesClause.join(', ')}`,
          params
        );

        for (let i = 0; i < qList.length; i++) {
          insertedIds.push(res.insertId + i);
        }
      }

      sendSuccess(res, {
        examId,
        count: insertedIds.length,
        importedCount: insertedIds.length,
        questionIds: insertedIds,
      }, 201);
    } catch (err) {
      next(err);
    }
  }
);

const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.coerce.number().int().positive()).min(1),
});

// PUT /api/exams/:examId/questions/reorder (ADMIN)
examsRouter.put(
  '/:examId/questions/reorder',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema, body: reorderQuestionsSchema }),
  async (req, res, next) => {
    try {
      const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
      const { questionIds } = req.body as z.infer<typeof reorderQuestionsSchema>;

      const exams = await queryRows<ExamRow[]>('SELECT id, is_published FROM Exams WHERE id = ? LIMIT 1', [examId]);
      if (!exams[0]) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }
      if (exams[0].is_published) {
        throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot modify questions of a published exam. Unpublish the exam first.');
      }

      await withConnection(async (conn) => {
        await conn.beginTransaction();
        try {
          for (let i = 0; i < questionIds.length; i++) {
            await conn.execute(
              'UPDATE Questions SET order_index = ? WHERE id = ? AND exam_id = ?',
              [i + 1, questionIds[i], examId]
            );
          }
          await conn.commit();
        } catch (e) {
          await conn.rollback();
          throw e;
        }
      });

      const updated = await queryRows<QuestionRow[]>(
        'SELECT * FROM Questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC',
        [examId]
      );
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  }
);

async function handleUpdateQuestion(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { examId, questionId } = req.params as unknown as z.infer<typeof questionIdParamSchema>;
    const body = req.body as z.infer<typeof updateQuestionSchema>;

    const exams = await queryRows<ExamRow[]>('SELECT id, is_published FROM Exams WHERE id = ? LIMIT 1', [examId]);
    if (!exams[0]) {
      throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    }
    if (exams[0].is_published) {
      throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot modify questions of a published exam. Unpublish the exam first.');
    }

    const rows = await queryRows<QuestionRow[]>(
      'SELECT * FROM Questions WHERE id = ? AND exam_id = ? LIMIT 1',
      [questionId, examId]
    );
    const existing = rows[0];
    if (!existing) {
      throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found for this exam.');
    }

    await executeSql(
      `UPDATE Questions
          SET question_text = ?,
              option_a = ?,
              option_b = ?,
              option_c = ?,
              option_d = ?,
              correct_option = ?,
              marks = ?,
              order_index = ?
        WHERE id = ? AND exam_id = ?`,
      [
        body.questionText ?? existing.question_text,
        body.optionA ?? existing.option_a,
        body.optionB ?? existing.option_b,
        body.optionC ?? existing.option_c,
        body.optionD ?? existing.option_d,
        body.correctOption ?? existing.correct_option,
        body.marks ?? existing.marks,
        body.orderIndex ?? existing.order_index,
        questionId,
        examId,
      ]
    );

    const updated = await queryRows<QuestionRow[]>(
      'SELECT * FROM Questions WHERE id = ? LIMIT 1',
      [questionId]
    );
    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
}

examsRouter.put(
  '/:examId/questions/:questionId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: questionIdParamSchema, body: updateQuestionSchema }),
  handleUpdateQuestion
);

examsRouter.patch(
  '/:examId/questions/:questionId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: questionIdParamSchema, body: updateQuestionSchema }),
  handleUpdateQuestion
);

const bulkDeleteQuestionsSchema = z.object({
  questionIds: z.array(z.coerce.number().int().positive()).min(1, 'At least 1 question ID is required'),
});

async function handleBulkDeleteQuestions(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { examId } = req.params as unknown as z.infer<typeof examIdParamSchema>;
    const { questionIds } = req.body as z.infer<typeof bulkDeleteQuestionsSchema>;

    const exams = await queryRows<ExamRow[]>('SELECT id, is_published FROM Exams WHERE id = ? LIMIT 1', [examId]);
    if (!exams[0]) {
      throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    }
    if (exams[0].is_published) {
      throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot modify questions of a published exam. Unpublish the exam first.');
    }

    const placeholders = questionIds.map(() => '?').join(', ');
    const result = await executeSql(
      `DELETE FROM Questions WHERE exam_id = ? AND id IN (${placeholders})`,
      [examId, ...questionIds]
    );

    sendSuccess(res, { deleted: true, count: result.affectedRows, questionIds });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/exams/:examId/questions (ADMIN) - Bulk Delete
examsRouter.delete(
  '/:examId/questions',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema, body: bulkDeleteQuestionsSchema }),
  handleBulkDeleteQuestions
);

// POST /api/exams/:examId/questions/bulk-delete (ADMIN) - Alternative for clients without DELETE body support
examsRouter.post(
  '/:examId/questions/bulk-delete',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: examIdParamSchema, body: bulkDeleteQuestionsSchema }),
  handleBulkDeleteQuestions
);

// DELETE /api/exams/:examId/questions/:questionId (ADMIN)
examsRouter.delete(
  '/:examId/questions/:questionId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: questionIdParamSchema }),
  async (req, res, next) => {
    try {
      const { examId, questionId } = req.params as unknown as z.infer<typeof questionIdParamSchema>;

      const exams = await queryRows<ExamRow[]>('SELECT id, is_published FROM Exams WHERE id = ? LIMIT 1', [examId]);
      if (!exams[0]) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
      }
      if (exams[0].is_published) {
        throw new AppError(409, 'EXAM_PUBLISHED', 'Cannot modify questions of a published exam. Unpublish the exam first.');
      }

      const result = await executeSql('DELETE FROM Questions WHERE id = ? AND exam_id = ?', [
        questionId,
        examId,
      ]);
      if (result.affectedRows === 0) {
        throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found for this exam.');
      }
      sendSuccess(res, { deleted: true, questionId });
    } catch (err) {
      next(err);
    }
  }
);
