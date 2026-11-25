import { queryRows } from '../config/db.js';
import type { ExamSessionRow, JwtUserPayload } from '../types/api.js';

export const CHANNELS = {
  PROCTORS: 'private-role-proctor',
  ADMINS: 'private-role-admin',
  user: (userId: number) => `private-user-${userId}`,
  session: (sessionId: number) => `private-session-${sessionId}`,
} as const;

/**
 * Checks whether an authenticated user has permission to subscribe to a given channel.
 *
 * Rules:
 * - private-role-admin: ADMIN only
 * - private-role-proctor: PROCTOR or ADMIN
 * - private-user-<id>: Target user, or PROCTOR / ADMIN
 * - private-session-<id>: PROCTOR / ADMIN, or the student enrolled in that session
 */
export async function isUserAuthorizedForChannel(
  user: JwtUserPayload,
  channel: string
): Promise<boolean> {
  if (!channel || typeof channel !== 'string') return false;

  // 1. Role channels
  if (channel === CHANNELS.ADMINS) {
    return user.role === 'ADMIN';
  }
  if (channel === CHANNELS.PROCTORS) {
    return user.role === 'PROCTOR' || user.role === 'ADMIN';
  }

  // 2. User channels: private-user-<id>
  const userMatch = channel.match(/^private-user-(\d+)$/);
  if (userMatch) {
    const targetUserId = Number(userMatch[1]);
    if (user.role === 'ADMIN' || user.role === 'PROCTOR') {
      return true;
    }
    return user.sub === targetUserId;
  }

  // 3. Session channels: private-session-<id>
  const sessionMatch = channel.match(/^private-session-(\d+)$/);
  if (sessionMatch) {
    const sessionId = Number(sessionMatch[1]);
    if (user.role === 'ADMIN' || user.role === 'PROCTOR') {
      return true;
    }
    // Student must own this session
    try {
      const rows = await queryRows<ExamSessionRow[]>(
        'SELECT id, student_id FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      return Boolean(rows[0] && rows[0].student_id === user.sub);
    } catch (err) {
      console.error('[RealtimeChannels] Failed to verify session ownership:', err);
      return false;
    }
  }

  return false;
}

/**
 * Returns the default set of authorized channels for a user when polling without specific channel parameters.
 */
export function getDefaultUserChannels(user: JwtUserPayload): string[] {
  if (user.role === 'ADMIN') {
    return [CHANNELS.PROCTORS, CHANNELS.ADMINS, CHANNELS.user(user.sub)];
  }
  if (user.role === 'PROCTOR') {
    return [CHANNELS.PROCTORS, CHANNELS.user(user.sub)];
  }
  return [CHANNELS.user(user.sub)];
}
