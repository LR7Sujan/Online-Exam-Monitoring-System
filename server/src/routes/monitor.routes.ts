import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, queryRows } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../utils/response.js';

export const monitorRouter = Router();

monitorRouter.use(requireAuth, requireRole('PROCTOR', 'ADMIN'));

const liveQuerySchema = z.object({
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
  code: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// GET /api/monitor/kpis — authoritative real-time KPIs
monitorRouter.get('/kpis', async (_req, res, next) => {
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

// GET /api/monitor/live — queries vw_ProctorLiveMonitor
monitorRouter.get(
  '/live',
  validate({ query: liveQuerySchema }),
  async (req, res, next) => {
    try {
      const { examId, status } = req.query as unknown as z.infer<typeof liveQuerySchema>;
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

// GET /api/monitor/extensions — active and recent time extension requests
monitorRouter.get('/extensions', async (_req, res, next) => {
  try {
    // 1. Auto-expire pending requests older than 180 seconds (3 minutes)
    await executeSql(
      `UPDATE Time_Extension_Requests
          SET status = 'EXPIRED'
        WHERE status = 'PENDING'
          AND created_at <= DATE_SUB(NOW(), INTERVAL 180 SECOND)`
    );

    // 2. Fetch requests with session, exam, student, and decider details
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT
         ter.request_id,
         ter.request_id AS id,
         ter.session_id,
         ter.requested_minutes,
         ter.reason,
         ter.status,
         ter.granted_minutes,
         ter.decided_by,
         ter.decided_at,
         ter.created_at,
         TIMESTAMPDIFF(SECOND, ter.created_at, NOW()) AS age_seconds,
         GREATEST(0, 180 - TIMESTAMPDIFF(SECOND, ter.created_at, NOW())) AS seconds_until_expiry,
         es.exam_id,
         es.student_id,
         es.trust_score,
         es.status AS session_status,
         es.extra_minutes_granted,
         es.server_deadline,
         GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), es.server_deadline)) AS seconds_remaining,
         e.title AS exam_title,
         e.max_extension_mins,
         e.duration_minutes,
         u.full_name AS student_name,
         u.email AS student_email,
         decider.full_name AS decided_by_name,
         COALESCE(pl.violation_count, 0) AS total_violations
       FROM Time_Extension_Requests ter
       JOIN Exam_Sessions es ON es.id = ter.session_id
       JOIN Exams e ON e.id = es.exam_id
       JOIN Users u ON u.id = es.student_id
       LEFT JOIN Users decider ON decider.id = ter.decided_by
       LEFT JOIN (
         SELECT session_id, COUNT(*) AS violation_count
           FROM Proctoring_Logs
          GROUP BY session_id
       ) pl ON pl.session_id = es.id
      ORDER BY FIELD(ter.status, 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'),
               ter.created_at DESC`
    );

    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/monitor/audit — queries vw_ViolationAuditReport with filters
monitorRouter.get(
  '/audit',
  validate({ query: auditQuerySchema }),
  async (req, res, next) => {
    try {
      const { examId, sessionId, reviewStatus, severity, code, limit } =
        req.query as unknown as z.infer<typeof auditQuerySchema>;
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
      if (code !== undefined && code.length > 0) {
        conditions.push('violation_code = ?');
        params.push(code.toUpperCase());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
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

