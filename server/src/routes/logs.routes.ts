import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, queryRows } from '../config/db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitSessionUpdate } from '../realtime/socket.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const logsRouter = Router();

logsRouter.use(requireAuth, requireRole('PROCTOR', 'ADMIN'));

const logIdParamSchema = z.object({
  logId: z.coerce.number().int().positive(),
});

const reviewBodySchema = z
  .object({
    status: z.enum(['CONFIRMED', 'DISMISSED']).optional(),
    reviewStatus: z.enum(['CONFIRMED', 'DISMISSED']).optional(),
    reviewNotes: z.string().trim().max(500).optional(),
  })
  .refine((v) => Boolean(v.status || v.reviewStatus), {
    message: 'Either status or reviewStatus (CONFIRMED | DISMISSED) is required.',
  });

// POST /api/logs/bulk-review
logsRouter.post(
  '/bulk-review',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { logIds, status, reviewStatus, reviewNotes } = req.body as {
        logIds?: number[];
        status?: 'CONFIRMED' | 'DISMISSED';
        reviewStatus?: 'CONFIRMED' | 'DISMISSED';
        reviewNotes?: string;
      };
      const finalStatus = status ?? reviewStatus;
      if (!Array.isArray(logIds) || logIds.length === 0 || !finalStatus) {
        throw new AppError(400, 'INVALID_BODY', 'logIds array and status are required.');
      }

      // Single batched query instead of N+1 roundtrips
      const placeholders = logIds.map(() => '?').join(',');
      await executeSql(
        `UPDATE Proctoring_Logs
            SET proctor_review_status = ?,
                reviewed_by = ?,
                reviewed_at = NOW(),
                review_notes = ?
          WHERE id IN (${placeholders})`,
        [finalStatus, req.user!.sub, reviewNotes ?? `Bulk review: ${finalStatus}`, ...logIds]
      );

      const updatedRows = await queryRows<RowDataPacket[]>(
        `SELECT * FROM vw_ViolationAuditReport WHERE log_id IN (${logIds.map(() => '?').join(',')})`,
        logIds
      );

      for (const row of updatedRows) {
        const studentId = Number(row.student_id);
        const sId = Number(row.session_id);
        const trust = Number(row.current_trust_score);
        emitSessionUpdate(
          studentId,
          sId,
          {
            logId: Number(row.log_id),
            sessionId: sId,
            reviewStatus: finalStatus,
            reviewerName: req.user!.fullName,
            trust_score: trust,
            updatedTrustScore: trust,
            status: row.session_status,
          },
          {
            sessionId: sId,
            trust_score: trust,
            status: String(row.session_status),
          }
        );
      }

      sendSuccess(res, {
        updatedCount: logIds.length,
        status: finalStatus,
        logs: updatedRows,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/logs/:logId/review { status: CONFIRMED | DISMISSED }
logsRouter.patch(
  '/:logId/review',
  validate({ params: logIdParamSchema, body: reviewBodySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { logId } = req.params as unknown as z.infer<typeof logIdParamSchema>;
      const body = req.body as z.infer<typeof reviewBodySchema>;
      const nextStatus = body.status ?? body.reviewStatus!;

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
        [nextStatus, req.user!.sub, body.reviewNotes ?? null, logId]
      );

      const updated = await queryRows<RowDataPacket[]>(
        'SELECT * FROM vw_ViolationAuditReport WHERE log_id = ? LIMIT 1',
        [logId]
      );
      const row = updated[0];

      if (row) {
        emitSessionUpdate(
          Number(row.student_id),
          sessionId,
          {
            logId,
            sessionId,
            reviewStatus: nextStatus,
            reviewerName: req.user!.fullName,
            trust_score: Number(row.current_trust_score),
            updatedTrustScore: Number(row.current_trust_score),
            status: row.session_status,
          },
          {
            sessionId,
            trust_score: Number(row.current_trust_score),
            status: String(row.session_status),
          }
        );
      }

      sendSuccess(res, row);
    } catch (err) {
      next(err);
    }
  }
);

