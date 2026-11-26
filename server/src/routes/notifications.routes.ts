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

function cleanViolationLabel(codeOrLabel: string): string {
  const normalized = codeOrLabel.toUpperCase().trim();
  const map: Record<string, string> = {
    PHONE_DETECTED: 'a mobile phone',
    PHONE: 'a mobile phone',
    MULTIPLE_FACES: 'multiple faces',
    NO_FACE: 'absence from camera',
    NO_FACE_DETECTED: 'absence from camera',
    FACE_ABSENT: 'absence from camera',
    TAB_SWITCH: 'a tab or window switch',
    DEVTOOLS_OPEN: 'developer tools',
    FULLSCREEN_EXIT: 'fullscreen exit',
    LOOKING_AWAY: 'looking away repeatedly',
    VOICE_DETECTED: 'background conversation',
    SUSPICIOUS_AUDIO: 'suspicious audio',
    COPY_PASTE: 'clipboard copy/paste attempt',
  };
  return map[normalized] || normalized.toLowerCase().replace(/_/g, ' ');
}

function mapNotificationForStudent(
  r: NotificationDbRow,
  payload: Record<string, unknown> | null
): { title: string; message: string; type: string } {
  const type = r.type;
  const exam = r.exam_title || 'your exam';
  const rawTitle = r.title || '';
  const rawMessage = r.message || '';

  // 1. Warnings / Violations
  if (
    type === 'WARNING' ||
    type === 'VIOLATION' ||
    rawTitle.toLowerCase().includes('warning') ||
    rawTitle.toLowerCase().includes('violation')
  ) {
    const code = (payload?.violationCode as string) || (payload?.code as string) || rawTitle;
    const label = cleanViolationLabel(code);
    const penalty = Number(payload?.penaltyApplied ?? payload?.penalty ?? 0);
    const penaltyStr = penalty > 0 ? ` (-${penalty} points)` : '';
    return {
      type: 'WARNING',
      title: 'Warning Issued',
      message: `A warning was issued during ${exam}: ${label} was detected${penaltyStr}.`,
    };
  }

  // 2. Extra time decision
  if (
    type === 'EXTENSION' ||
    rawTitle.toLowerCase().includes('extension') ||
    rawTitle.toLowerCase().includes('time')
  ) {
    const status =
      (payload?.status as string) ||
      (payload?.decision as string) ||
      (rawTitle.toLowerCase().includes('approv') || rawMessage.toLowerCase().includes('approved')
        ? 'APPROVED'
        : 'DECLINED');
    const isApproved = status === 'APPROVED';
    const minutes = Number(payload?.minutesGranted ?? payload?.grantedMinutes ?? 10);
    return {
      type: 'EXTENSION',
      title: isApproved ? 'Extra Time Approved' : 'Extra Time Declined',
      message: isApproved
        ? `Your request for ${minutes} extra minutes was approved.`
        : 'Your request for extra time was declined.',
    };
  }

  // 3. Exam terminated
  if (type === 'TERMINATION' || rawTitle.toLowerCase().includes('terminat')) {
    return {
      type: 'TERMINATION',
      title: 'Exam Terminated',
      message:
        'Your assessment was terminated because your trust score dropped below the required threshold.',
    };
  }

  // 4. Review outcome
  if (type === 'REVIEW' || rawTitle.toLowerCase().includes('review') || payload?.reviewStatus) {
    const status = (payload?.reviewStatus as string) || (payload?.status as string) || '';
    const isDismissed = status === 'DISMISSED' || rawMessage.toLowerCase().includes('dismiss');
    return {
      type: 'INFO',
      title: 'Review Outcome',
      message: isDismissed
        ? `A flagged event in ${exam} was dismissed and your points were restored.`
        : `A flagged event in ${exam} was reviewed and confirmed.`,
    };
  }

  // 5. Results available
  if (
    type === 'RESULT' ||
    rawTitle.toLowerCase().includes('result') ||
    rawTitle.toLowerCase().includes('submission') ||
    rawTitle.toLowerCase().includes('graded')
  ) {
    return {
      type: 'INFO',
      title: 'Results Available',
      message: `Your result for ${exam} is ready.`,
    };
  }

  // 6. Exam reminders
  if (
    type === 'REMINDER' ||
    rawTitle.toLowerCase().includes('reminder') ||
    rawTitle.toLowerCase().includes('opens')
  ) {
    return {
      type: 'INFO',
      title: 'Exam Reminder',
      message: rawMessage || `${exam} opens soon.`,
    };
  }

  return {
    type: r.type,
    title: r.title,
    message: r.message,
  };
}

/**
 * GET /api/notifications
 * Retrieves paginated notifications for the authenticated user, ordered by creation date descending.
 */
notificationsRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const isStudent = req.user!.role === 'STUDENT';
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
      let parsedPayload: Record<string, unknown> | null = null;
      if (typeof r.payload === 'string') {
        try {
          parsedPayload = JSON.parse(r.payload);
        } catch {
          parsedPayload = null;
        }
      } else if (r.payload && typeof r.payload === 'object') {
        parsedPayload = r.payload as Record<string, unknown>;
      }

      let notifTitle = r.title;
      let notifMessage = r.message;
      let notifType = r.type;

      if (isStudent) {
        const studentFormat = mapNotificationForStudent(r, parsedPayload);
        notifTitle = studentFormat.title;
        notifMessage = studentFormat.message;
        notifType = studentFormat.type;
      }

      return {
        id: Number(r.id),
        type: notifType,
        severity: r.severity,
        title: notifTitle,
        message: notifMessage,
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
 * GET /api/notifications/:id
 * Retrieves a single notification with IDOR authorization guard.
 */
notificationsRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const isStudent = req.user!.role === 'STUDENT';
    const notifId = Number(req.params.id);

    if (!Number.isInteger(notifId) || notifId <= 0) {
      throw new AppError(400, 'INVALID_NOTIFICATION_ID', 'Invalid notification ID.');
    }

    const rows = await queryRows<NotificationDbRow[]>(
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
        WHERE n.id = ?`,
      [notifId]
    );

    const row = rows[0];
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
    }

    if (Number(row.user_id) !== userId) {
      throw new AppError(403, 'FORBIDDEN', "Access to another user's message is strictly prohibited.");
    }

    let parsedPayload: Record<string, unknown> | null = null;
    if (typeof row.payload === 'string') {
      try {
        parsedPayload = JSON.parse(row.payload);
      } catch {
        parsedPayload = null;
      }
    } else if (row.payload && typeof row.payload === 'object') {
      parsedPayload = row.payload as Record<string, unknown>;
    }

    let notifTitle = row.title;
    let notifMessage = row.message;
    let notifType = row.type;

    if (isStudent) {
      const studentFormat = mapNotificationForStudent(row, parsedPayload);
      notifTitle = studentFormat.title;
      notifMessage = studentFormat.message;
      notifType = studentFormat.type;
    }

    sendSuccess(res, {
      id: Number(row.id),
      type: notifType,
      severity: row.severity,
      title: notifTitle,
      message: notifMessage,
      sessionId: row.sessionId ? Number(row.sessionId) : undefined,
      studentName: row.studentName ?? undefined,
      examTitle: row.examTitle ?? undefined,
      isSessionLive: Boolean(row.isSessionLive),
      createdAt: row.createdAt,
      readAt: row.readAt,
      payload: parsedPayload ?? undefined,
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

    // Verify ownership
    const rows = await queryRows<RowDataPacket[]>('SELECT user_id FROM Notifications WHERE id = ?', [
      notifId,
    ]);
    if (rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
    }
    if (Number(rows[0].user_id) !== userId) {
      throw new AppError(403, 'FORBIDDEN', "Access to another user's message is strictly prohibited.");
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
