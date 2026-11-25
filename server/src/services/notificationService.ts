import { executeSql, queryRows } from '../config/db.js';
import { getRealtimeAdapter } from '../realtime/adapter.js';
import { CHANNELS } from '../realtime/channels.js';
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
    const adapter = getRealtimeAdapter();
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
    void adapter.publish(CHANNELS.user(params.userId), 'notification:new', socketPayload);

    return insertedId;
  } catch (err) {
    console.error('[NotificationService] Failed to create notification:', err);
    return null;
  }
}

let proctorAdminCache: { ids: number[]; lastFetched: number } | null = null;

async function getProctorAdminIds(): Promise<number[]> {
  const now = Date.now();
  if (proctorAdminCache && now - proctorAdminCache.lastFetched < 30000) {
    return proctorAdminCache.ids;
  }
  const rows = await queryRows<UserRow[]>(
    "SELECT id FROM Users WHERE role IN ('PROCTOR', 'ADMIN') AND is_active = 1"
  );
  const ids = rows.map((r) => r.id);
  proctorAdminCache = { ids, lastFetched: now };
  return ids;
}

/**
 * Dispatches a notification to all active Proctors and Admins.
 */
export async function notifyProctorsAndAdmins(
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  try {
    const ids = await getProctorAdminIds();
    if (ids.length === 0) return;

    const payloadJson = params.payload ? JSON.stringify(params.payload) : null;
    const placeholders = ids.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
    const values: (string | number | null)[] = [];
    for (const uid of ids) {
      values.push(
        uid,
        params.type,
        params.severity,
        params.title,
        params.message,
        params.sessionId ?? null,
        params.studentName ?? null,
        params.examTitle ?? null,
        payloadJson
      );
    }

    const res = await executeSql(
      `INSERT INTO Notifications
         (user_id, type, severity, title, message, session_id, student_name, exam_title, payload, created_at)
       VALUES ${placeholders}`,
      values
    );

    const insertedId = res.insertId;
    const adapter = getRealtimeAdapter();
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
    void adapter.publish(CHANNELS.PROCTORS, 'notification:new', socketPayload);
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
