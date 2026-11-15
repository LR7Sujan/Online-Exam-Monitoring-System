import type { RowDataPacket } from 'mysql2/promise';
import cron, { type ScheduledTask } from 'node-cron';
import { pool, queryRows } from '../config/db.js';
import { emitExamSubmitted } from '../realtime/socket.js';

let task: ScheduledTask | null = null;

export async function runAutoTimeoutSweep(): Promise<number> {
  const beforeRows = await queryRows<RowDataPacket[]>(
    `SELECT es.id, es.student_id, es.exam_id
       FROM Exam_Sessions es
       JOIN Exams e ON e.id = es.exam_id
       LEFT JOIN Time_Extension_Requests ter
         ON ter.session_id = es.id
        AND ter.status = 'PENDING'
        AND ter.created_at >= DATE_SUB(NOW(), INTERVAL 3 MINUTE)
      WHERE es.status = 'IN_PROGRESS'
        AND ter.request_id IS NULL
        AND NOW() > DATE_ADD(es.started_at, INTERVAL (e.duration_minutes + es.extra_minutes_granted) MINUTE)`
  );

  const [resultSets] = await pool.query<RowDataPacket[][]>('CALL sp_AutoTimeoutExpiredSessions()');
  const lastSet = resultSets[resultSets.length - 1];
  const processed = Number(lastSet?.[0]?.timed_out_sessions_processed ?? 0);

  if (processed > 0) {
    for (const row of beforeRows) {
      const sid = Number(row.id);
      const studentId = Number(row.student_id);
      const [sess] = await queryRows<RowDataPacket[]>(
        'SELECT trust_score, status FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sid]
      );
      if (sess) {
        emitExamSubmitted(
          studentId,
          sid,
          { sessionId: sid, examId: row.exam_id, studentId, status: sess.status, trust_score: sess.trust_score },
          { sessionId: sid, trust_score: Number(sess.trust_score), status: String(sess.status) }
        );
      }
    }
  }

  return processed;
}

export function startAutoTimeoutCron(): void {
  if (task) return;
  task = cron.schedule('* * * * *', () => {
    runAutoTimeoutSweep().catch((err) => {
      console.error('[ProctorIQ Cron] Auto-timeout sweep failed:', err);
    });
  });
}

export function stopAutoTimeoutCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}

