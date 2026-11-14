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
import { sendSuccess } from '../utils/response.js';

export const examsRouter = Router();

const examIdParamSchema = z.object({
  examId: z.coerce.number().int().positive(),
});

const questionIdParamSchema = z.object({
  examId: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
});

const createExamSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(1).max(480),
  minTrustScore: z.coerce.number().int().min(0).max(100).default(50),
  startWindow: z.string().min(10),
  endWindow: z.string().min(10),
  isPublished: z.boolean().default(false),
});

const updateExamSchema = createExamSchema.partial();

const createQuestionSchema = z.object({
  questionText: z.string().trim().min(5).max(4000),
  optionA: z.string().trim().min(1).max(500),
  optionB: z.string().trim().min(1).max(500),
  optionC: z.string().trim().min(1).max(500),
  optionD: z.string().trim().min(1).max(500),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  marks: z.coerce.number().positive().max(1000).default(1),
  orderIndex: z.coerce.number().int().positive().optional(),
});

const updateQuestionSchema = createQuestionSchema.partial();

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
        `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.min_trust_score,
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
           e.id, e.title, e.description, e.duration_minutes, e.min_trust_score,
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
           e.id, e.title, e.description, e.duration_minutes, e.min_trust_score,
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
         e.id, e.title, e.description, e.duration_minutes, e.min_trust_score,
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
        `SELECT id, title, description, duration_minutes, min_trust_score,
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

      sendSuccess(res, { exam, questions });
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
      const startWin = toMysqlDateTime(body.startWindow);
      const endWin = toMysqlDateTime(body.endWindow);

      const result = await executeSql(
        `INSERT INTO Exams
          (title, description, duration_minutes, min_trust_score, start_window, end_window, is_published, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.title,
          body.description ?? null,
          body.durationMinutes,
          body.minTrustScore,
          startWin,
          endWin,
          body.isPublished,
          req.user!.sub,
        ]
      );

      const created = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [
        result.insertId,
      ]);
      sendSuccess(res, created[0], 201);
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

    await executeSql(
      `UPDATE Exams
          SET title = ?,
              description = ?,
              duration_minutes = ?,
              min_trust_score = ?,
              start_window = ?,
              end_window = ?,
              is_published = ?
        WHERE id = ?`,
      [
        body.title ?? existing.title,
        body.description !== undefined ? body.description : existing.description,
        body.durationMinutes ?? existing.duration_minutes,
        body.minTrustScore ?? existing.min_trust_score,
        startWin,
        endWin,
        body.isPublished !== undefined ? body.isPublished : Boolean(existing.is_published),
        examId,
      ]
    );

    const updated = await queryRows<ExamRow[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [
      examId,
    ]);
    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
}

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

      const exams = await queryRows<ExamRow[]>('SELECT id FROM Exams WHERE id = ? LIMIT 1', [
        examId,
      ]);
      if (!exams[0]) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
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
          body.optionC,
          body.optionD,
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

      const exams = await queryRows<ExamRow[]>('SELECT id FROM Exams WHERE id = ? LIMIT 1', [examId]);
      if (!exams[0]) {
        throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
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

async function handleUpdateQuestion(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { examId, questionId } = req.params as unknown as z.infer<typeof questionIdParamSchema>;
    const body = req.body as z.infer<typeof updateQuestionSchema>;

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

// DELETE /api/exams/:examId/questions/:questionId (ADMIN)
examsRouter.delete(
  '/:examId/questions/:questionId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: questionIdParamSchema }),
  async (req, res, next) => {
    try {
      const { examId, questionId } = req.params as unknown as z.infer<typeof questionIdParamSchema>;
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
