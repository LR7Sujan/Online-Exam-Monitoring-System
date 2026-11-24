import { executeSql, queryRows } from '../config/db.js';
import { getIo } from '../realtime/socket.js';
import type { RowDataPacket } from 'mysql2';

export interface CreateNotificationParams {
  userId: number;
  type: 'VIOLATION' | 'WARNING' | 'TERMINATION' | 'EXTENSION' | 'INFO';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  message: string;
  sessionId?: number;
  studentName?: string;
  examTitle?: string;
  payload?: Record<string, unknown>;
}

interface UserRow extends RowDataPacket {
  id: number;
}

/**
 * Creates and persists a notification for a specific user and emits a real-time event.
 */
export async function createNotification(params: CreateNotificationParams): Promise<number | null> {
  try {
    const payloadJson = params.payload ? JSON.stringify(params.payload) : null;
    const res = await executeSql(
      `INSERT INTO Notifications
         (user_id, type, severity, title, message, session_id, student_name, exam_title, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        params.userId,
        params.type,
        params.severity,
        params.title,
        params.message,
        params.sessionId ?? null,
        params.studentName ?? null,
        params.examTitle ?? null,
        payloadJson,
      ]
    );

    const insertedId = res.insertId;
    const io = getIo();
    if (io) {
      const socketPayload = {
        id: insertedId,
        type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        sessionId: params.sessionId,
        studentName: params.studentName,
        examTitle: params.examTitle,
        isSessionLive: true,
        createdAt: new Date().toISOString(),
        readAt: null,
        payload: params.payload,
      };
      io.to(`user:${params.userId}`).emit('notification:new', socketPayload);
    }

    return insertedId;
  } catch (err) {
    console.error('[NotificationService] Failed to create notification:', err);
    return null;
  }
}

/**
 * Dispatches a notification to all active Proctors and Admins.
 */
export async function notifyProctorsAndAdmins(
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  try {
    const proctorRows = await queryRows<UserRow[]>(
      "SELECT id FROM Users WHERE role IN ('PROCTOR', 'ADMIN') AND is_active = 1"
    );

    for (const p of proctorRows) {
      await createNotification({
        ...params,
        userId: p.id,
      });
    }
  } catch (err) {
    console.error('[NotificationService] Failed to notify proctors and admins:', err);
  }
}

/**
 * Dispatches a notification to a specific student examinee.
 */
export async function notifyStudent(
  studentId: number,
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  await createNotification({
    ...params,
    userId: studentId,
  });
}
