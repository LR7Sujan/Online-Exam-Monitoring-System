import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { pool, queryRows } from '../config/db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitExtensionDecided } from '../realtime/socket.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const extensionsRouter = Router();

extensionsRouter.use(requireAuth, requireRole('PROCTOR', 'ADMIN'));

const requestIdParamSchema = z.object({
  requestId: z.coerce.number().int().positive(),
});

const decideExtensionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  grantedMinutes: z.coerce.number().int().min(1).max(120).optional(),
});

// POST /api/extensions/:requestId/decide (PROCTOR | ADMIN)
extensionsRouter.post(
  '/:requestId/decide',
  validate({ params: requestIdParamSchema, body: decideExtensionSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { requestId } = req.params as unknown as z.infer<typeof requestIdParamSchema>;
      const { decision, grantedMinutes } = req.body as z.infer<typeof decideExtensionSchema>;

      const [resultSets] = await pool.query<RowDataPacket[][]>(
        'CALL sp_DecideExtension(?, ?, ?, ?)',
        [requestId, req.user!.sub, decision, grantedMinutes ?? null]
      );

      // In MySQL, nested stored procedure calls (like sp_SubmitAndGradeExam inside sp_DecideExtension)
      // yield multiple result sets. Find the one corresponding to the extension decision.
      let result: RowDataPacket | undefined;
      for (const rs of resultSets) {
        if (Array.isArray(rs) && rs[0] && ('request_id' in rs[0] || 'request_status' in rs[0])) {
          result = rs[0];
          break;
        }
      }
      if (!result && resultSets[0]?.[0]) {
        result = resultSets[0][0];
      }

      if (!result) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Extension request not found.');
      }

      if (result.already_decided) {
        throw new AppError(
          409,
          'ALREADY_DECIDED',
          `This request has already been decided or closed (status: ${result.request_status}).`
        );
      }

      // Fetch student details to emit real-time event
      const sessionInfo = await queryRows<RowDataPacket[]>(
        `SELECT es.student_id, u.full_name AS student_name, e.title AS exam_title
           FROM Exam_Sessions es
           JOIN Users u ON u.id = es.student_id
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?
          LIMIT 1`,
        [result.session_id]
      );
      const studentId = Number(sessionInfo[0]?.student_id ?? 0);

      emitExtensionDecided(
        studentId,
        Number(result.session_id),
        {
          requestId: Number(result.request_id),
          sessionId: Number(result.session_id),
          decision,
          status: result.request_status,
          grantedMinutes: Number(result.granted_minutes ?? 0),
          decidedBy: req.user!.fullName,
          decidedAt: new Date().toISOString(),
          serverDeadline: result.server_deadline,
          secondsRemaining: Number(result.seconds_remaining ?? 0),
          sessionStatus: result.session_status,
        }
      );

      sendSuccess(res, {
        requestId: Number(result.request_id),
        sessionId: Number(result.session_id),
        requestStatus: result.request_status,
        status: result.request_status,
        grantedMinutes: Number(result.granted_minutes ?? 0),
        decidedBy: Number(result.decided_by),
        decidedByName: req.user!.fullName,
        decidedAt: result.decided_at,
        serverDeadline: result.server_deadline,
        secondsRemaining: Number(result.seconds_remaining ?? 0),
        sessionStatus: result.session_status,
        extraMinutesGranted: Number(result.extra_minutes_granted ?? 0),
      });
    } catch (err) {
      next(err);
    }
  }
);
