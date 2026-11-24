import { Router } from 'express';
import { executeSql, queryRows } from '../config/db.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import type { RowDataPacket } from 'mysql2';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

interface NotificationDbRow extends RowDataPacket {
  id: number;
  user_id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
  session_id: number | null;
  student_name: string | null;
  exam_title: string | null;
  payload: string | Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
  is_session_live: number | boolean;
}

interface CountRow extends RowDataPacket {
  total: number;
  unreadCount: number;
}

/**
 * GET /api/notifications
 * Retrieves paginated notifications for the authenticated user, ordered by creation date descending.
 */
notificationsRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      queryRows<NotificationDbRow[]>(
        `SELECT n.id,
                n.user_id,
                n.type,
                n.severity,
                n.title,
                n.message,
                n.session_id AS sessionId,
                n.student_name AS studentName,
                n.exam_title AS examTitle,
                n.payload,
                n.created_at AS createdAt,
                n.read_at AS readAt,
                COALESCE(es.status = 'IN_PROGRESS', FALSE) AS isSessionLive
           FROM Notifications n
      LEFT JOIN Exam_Sessions es ON es.id = n.session_id
          WHERE n.user_id = ?
          ORDER BY n.created_at DESC
          LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      ),
      queryRows<CountRow[]>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unreadCount
           FROM Notifications
          WHERE user_id = ?`,
        [userId]
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const unreadCount = Number(countRows[0]?.unreadCount ?? 0);

    const mapped = rows.map((r) => {
      let parsedPayload = r.payload;
      if (typeof r.payload === 'string') {
        try {
          parsedPayload = JSON.parse(r.payload);
        } catch {
          parsedPayload = r.payload;
        }
      }
      return {
        id: Number(r.id),
        type: r.type,
        severity: r.severity,
        title: r.title,
        message: r.message,
        sessionId: r.sessionId ? Number(r.sessionId) : undefined,
        studentName: r.studentName ?? undefined,
        examTitle: r.examTitle ?? undefined,
        isSessionLive: Boolean(r.isSessionLive),
        createdAt: r.createdAt,
        readAt: r.readAt,
        payload: parsedPayload ?? undefined,
      };
    });

    sendSuccess(res, {
      notifications: mapped,
      unreadCount,
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/:id/read
 * Marks a specific notification as read for the authenticated user.
 */
notificationsRouter.post('/:id/read', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const notifId = Number(req.params.id);

    if (!Number.isInteger(notifId) || notifId <= 0) {
      throw new AppError(400, 'INVALID_NOTIFICATION_ID', 'Invalid notification ID.');
    }

    const now = new Date().toISOString();
    await executeSql(
      'UPDATE Notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL',
      [notifId, userId]
    );

    sendSuccess(res, { id: notifId, readAt: now });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all notifications as read for the authenticated user.
 */
notificationsRouter.post('/read-all', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.sub;

    await executeSql(
      'UPDATE Notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
      [userId]
    );

    sendSuccess(res, { message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notifications
 * Clears all notifications for the authenticated user.
 */
notificationsRouter.delete('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.sub;

    await executeSql('DELETE FROM Notifications WHERE user_id = ?', [userId]);

    sendSuccess(res, { message: 'Notifications cleared.' });
  } catch (err) {
    next(err);
  }
});
