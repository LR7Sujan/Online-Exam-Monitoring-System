import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, pool, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { emitExamSubmitted } from '../realtime/index.js';

/**
 * Sweeps all expired sessions across the database using stored procedure sp_AutoTimeoutExpiredSessionsWithGrace.
 * Idempotent and race-safe (atomic row locking inside sp_SubmitAndGradeExam).
 */
export async function runAutoTimeoutSweep(): Promise<number> {
  const graceSeconds = env.EXTENSION_GRACE_SECONDS ?? 180;

  // Identify sessions that match auto-timeout criteria before execution so we can emit realtime notifications
  const beforeRows = await queryRows<RowDataPacket[]>(
    `SELECT es.id, es.student_id, es.exam_id
       FROM Exam_Sessions es
       JOIN Exams e ON e.id = es.exam_id
       LEFT JOIN Time_Extension_Requests ter
         ON ter.session_id = es.id
        AND ter.status = 'PENDING'
        AND ter.created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
      WHERE es.status = 'IN_PROGRESS'
        AND ter.request_id IS NULL
        AND (
          (COALESCE(e.max_extension_mins, 0) > 0 AND NOW() > DATE_ADD(es.server_deadline, INTERVAL ? SECOND))
          OR
          (COALESCE(e.max_extension_mins, 0) <= 0 AND NOW() > es.server_deadline)
        )`,
    [graceSeconds, graceSeconds]
  );

  const [resultSets] = await pool.query<RowDataPacket[][]>(
    'CALL sp_AutoTimeoutExpiredSessionsWithGrace(?)',
    [graceSeconds]
  );
  let processed = 0;
  for (const set of resultSets) {
    if (Array.isArray(set) && set[0] && 'timed_out_sessions_processed' in set[0]) {
      processed = Number((set[0] as { timed_out_sessions_processed: number | string }).timed_out_sessions_processed);
      break;
    }
  }

  if (processed > 0 && beforeRows.length > 0) {
    for (const row of beforeRows) {
      const sid = Number(row.id);
      const studentId = Number(row.student_id);
      const [sess] = await queryRows<RowDataPacket[]>(
        'SELECT trust_score, status FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sid]
      );
      if (sess && sess.status === 'TIMED_OUT') {
        emitExamSubmitted(
          studentId,
          sid,
          {
            sessionId: sid,
            examId: row.exam_id,
            studentId,
            status: sess.status,
            trust_score: sess.trust_score,
          },
          {
            sessionId: sid,
            trust_score: Number(sess.trust_score),
            status: String(sess.status),
          }
        );
      }
    }
  }

  return processed;
}

export interface LazyTimeoutScope {
  sessionId?: number;
  studentId?: number;
  examId?: number;
}

/**
 * Lazy enforcement for serverless execution:
 * Evaluates session deadline, extension-request expiry, and grace window on-demand without any background timers.
 *
 * If sessionId is provided:
 *   - Runs a cheap targeted query (<1ms) checking whether the specific session is past deadline & grace.
 *   - Auto-expires pending extension requests older than grace.
 *   - Records time_expired_at if session reached regular deadline.
 *   - If expired and no active unexpired extension request blocks it, times out and grades the session.
 *
 * If studentId or no scope is provided:
 *   - Checks if any candidate session is past deadline with a single LIMIT 1 query before running procedure.
 */
export async function enforceLazyTimeouts(scope?: LazyTimeoutScope): Promise<boolean> {
  const graceSeconds = env.EXTENSION_GRACE_SECONDS ?? 180;

  if (scope?.sessionId) {
    const sid = scope.sessionId;
    const sessionRows = await queryRows<RowDataPacket[]>(
      `SELECT es.id, es.student_id, es.exam_id, es.status, es.server_deadline, es.time_expired_at,
              COALESCE(e.max_extension_mins, 0) AS max_extension_mins
         FROM Exam_Sessions es
         JOIN Exams e ON e.id = es.exam_id
        WHERE es.id = ?
        LIMIT 1`,
      [sid]
    );

    const session = sessionRows[0];
    if (!session || session.status !== 'IN_PROGRESS') {
      return false;
    }

    const maxExt = Number(session.max_extension_mins);

    // 1. Auto-expire pending extension requests older than grace window
    await executeSql(
      `UPDATE Time_Extension_Requests
          SET status = 'EXPIRED'
        WHERE session_id = ?
          AND status = 'PENDING'
          AND created_at < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
      [sid, graceSeconds]
    );

    // 2. Record time_expired_at if past regular deadline
    await executeSql(
      `UPDATE Exam_Sessions
          SET time_expired_at = COALESCE(time_expired_at, server_deadline, NOW())
        WHERE id = ?
          AND status = 'IN_PROGRESS'
          AND NOW() >= server_deadline
          AND time_expired_at IS NULL`,
      [sid]
    );

    // 3. Check for any active, unexpired PENDING extension request (blocks timeout)
    const pendingReqs = await queryRows<RowDataPacket[]>(
      `SELECT request_id
         FROM Time_Extension_Requests
        WHERE session_id = ?
          AND status = 'PENDING'
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
        LIMIT 1`,
      [sid, graceSeconds]
    );

    if (pendingReqs.length > 0) {
      // Pending request exists and is within grace window: do NOT timeout
      return false;
    }

    // 4. Check if session has exceeded its deadline + grace
    const expiredRows = await queryRows<RowDataPacket[]>(
      `SELECT es.id
         FROM Exam_Sessions es
        WHERE es.id = ?
          AND es.status = 'IN_PROGRESS'
          AND (
            (? > 0 AND NOW() > DATE_ADD(es.server_deadline, INTERVAL ? SECOND))
            OR
            (? <= 0 AND NOW() > es.server_deadline)
          )
        LIMIT 1`,
      [sid, maxExt, graceSeconds, maxExt]
    );

    if (expiredRows.length === 0) {
      return false;
    }

    // 5. Execute timeout and grade session
    const processed = await runAutoTimeoutSweep();
    return processed > 0;
  }

  // Scoped to student or general sweep
  let checkSql = `
    SELECT es.id
      FROM Exam_Sessions es
      JOIN Exams e ON e.id = es.exam_id
     WHERE es.status = 'IN_PROGRESS'
       AND (
         (COALESCE(e.max_extension_mins, 0) > 0 AND NOW() > DATE_ADD(es.server_deadline, INTERVAL ? SECOND))
         OR
         (COALESCE(e.max_extension_mins, 0) <= 0 AND NOW() > es.server_deadline)
       )
  `;
  const params: (string | number)[] = [graceSeconds];

  if (scope?.studentId) {
    checkSql += ' AND es.student_id = ?';
    params.push(scope.studentId);
  } else if (scope?.examId) {
    checkSql += ' AND es.exam_id = ?';
    params.push(scope.examId);
  }

  checkSql += ' LIMIT 1';

  const check = await queryRows<RowDataPacket[]>(checkSql, params);
  if (check.length > 0) {
    const processed = await runAutoTimeoutSweep();
    return processed > 0;
  }

  return false;
}
