import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getStudentsList,
  getStudentProfile,
  getStudentSessions,
  getSessionScorecard,
} from '../services/studentAuditService.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const studentsRouter = Router();

const studentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  integrityStatus: z.enum(['ALL', 'CLEAN', 'FLAGGED', 'DISQUALIFIED']).optional(),
  trustMin: z.coerce.number().min(0).max(100).optional(),
  trustMax: z.coerce.number().min(0).max(100).optional(),
  attendance: z.enum(['ALL', 'ATTENDED', 'NEVER_ATTENDED']).optional(),
  sortBy: z.enum(['name', 'email', 'examsAttended', 'avgScore', 'avgTrust', 'lastExamDate', 'violations', 'warnings', 'createdAt']).optional(),
  sortDir: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

const studentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const sessionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * GET /api/students
 * List of registered students with SQL aggregates, filtering, sorting, pagination, and CSV export.
 */
studentsRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ query: studentListQuerySchema }),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof studentListQuerySchema>;
      const isCsv = query.format === 'csv';

      // If CSV export, fetch without pagination limits (up to 5000)
      const result = await getStudentsList({
        ...query,
        limit: isCsv ? 5000 : query.limit,
        page: isCsv ? 1 : query.page,
        sortDir: query.sortDir ? (query.sortDir.toUpperCase() as 'ASC' | 'DESC') : 'ASC',
      });

      if (isCsv) {
        const headers = [
          'ID',
          'Name',
          'Email',
          'Joined At',
          'Exams Attended',
          'Average Score %',
          'Average Trust %',
          'Worst Integrity Status',
          'Last Exam Date',
          'Total Violations',
          'Total Warnings',
          'Live Status',
        ];

        const rows = result.students.map((s) => [
          s.id,
          `"${s.name.replace(/"/g, '""')}"`,
          `"${s.email.replace(/"/g, '""')}"`,
          s.joinedAt,
          s.examsAttended,
          s.avgScore !== null ? s.avgScore : 'N/A',
          s.avgTrust !== null ? s.avgTrust : 'N/A',
          s.worstIntegrityStatus,
          s.lastExamDate || 'N/A',
          s.totalViolations,
          s.totalWarnings,
          s.isCurrentlyActive ? 'LIVE' : 'IDLE',
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="student_audit_export.csv"');
        res.status(200).send(csvContent);
        return;
      }

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/students/:id
 * Detailed student profile with KPIs, score/trust progress timeline, and violations distribution.
 */
studentsRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: studentIdParamSchema }),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof studentIdParamSchema>;
      const profile = await getStudentProfile(id);
      if (!profile) {
        throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student record not found');
      }
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/students/:id/sessions
 * List of attended examinations for the student.
 */
studentsRouter.get(
  '/:id/sessions',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: studentIdParamSchema }),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof studentIdParamSchema>;
      const sessions = await getStudentSessions(id);
      sendSuccess(res, sessions);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/sessions/:id/scorecard (also reachable via students router or sessions router)
 */
studentsRouter.get(
  '/sessions/:id/scorecard',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const scorecard = await getSessionScorecard(id);
      if (!scorecard) {
        throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found');
      }
      sendSuccess(res, scorecard);
    } catch (err) {
      next(err);
    }
  }
);
