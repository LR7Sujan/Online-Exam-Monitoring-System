import path from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { generateSignedSnapshotUrl } from './snapshotSigner.js';
import { getStorageAdapter, resolveStorageKey } from '../storage/index.js';

export interface ExamRecordingRow extends RowDataPacket {
  recording_id: number;
  session_id: number;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  duration_ms: number;
  status: 'RECORDING' | 'READY' | 'FAILED';
  legal_hold: number | boolean;
  started_at: Date;
  finished_at: Date | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RecordingNoteRow extends RowDataPacket {
  note_id: number;
  recording_id: number;
  author_id: number;
  author_name: string;
  time_ms: number;
  text: string;
  created_at: Date;
}

export interface ReviewTimelineEvent {
  id: string;
  logId?: number;
  type: 'VIOLATION' | 'WARNING';
  code: string;
  label: string;
  penalty: number;
  timeMs: number;
  occurredAt: string;
  severity?: string;
  status?: string;
  snapshotUrl?: string | null;
  reviewedBy?: number | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  warningAcknowledgedAt?: string | null;
  warningMessage?: string | null;
}

export interface RecordingReviewDetails {
  recording: ExamRecordingRow & { has_audio: boolean };
  session: {
    sessionId: number;
    studentName: string;
    studentEmail: string;
    examTitle: string;
    examId: number;
    paperCode: string;
    startedAt: string;
    finishedAt: string | null;
    currentTrustScore: number;
    minTrustScore: number;
    sessionStatus: string;
    ipAddress: string | null;
  };
  events: ReviewTimelineEvent[];
  notes: RecordingNoteRow[];
}

export interface StorageStats {
  totalBytes: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  recordingsCount: number;
  totalRecordings: number;
  oldestRecordingDate: string | null;
  oldestRecordingAt: string | null;
  maxStorageBytes: number;
  maxStorageGb: number;
  isStorageLimitExceeded: boolean;
  isExceeded: boolean;
  usagePercentage: number;
  warning: boolean;
  retentionDays: number;
}

/**
 * Returns logical root path for recordings in current environment.
 */
export function getRecordingsBaseDir(): string {
  const uploadsDir =
    path.isAbsolute(env.UPLOADS_DIR)
      ? env.UPLOADS_DIR
      : (process.cwd().endsWith('server') || process.cwd().endsWith('server\\') || process.cwd().endsWith('server/')) &&
        env.UPLOADS_DIR.startsWith('./server/')
      ? path.resolve(process.cwd(), '..', env.UPLOADS_DIR)
      : path.resolve(process.cwd(), env.UPLOADS_DIR);
  return path.resolve(uploadsDir, 'recordings');
}

/**
 * Returns logical path for specific session recording and its chunks.
 */
export function getSessionRecordingDir(examId: number, sessionId: number): string {
  return path.join(getRecordingsBaseDir(), String(examId), String(sessionId));
}

/**
 * Computes storage statistics from DBMS records.
 */
export async function getRecordingStorageStats(): Promise<StorageStats> {
  const rows = await queryRows<RowDataPacket[]>(
    `SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(size_bytes), 0) AS total_size,
        MIN(started_at) AS oldest_date
       FROM Exam_Recordings
      WHERE status = 'READY'`
  );

  const totalBytes = Number(rows[0]?.total_size ?? 0);
  const recordingsCount = Number(rows[0]?.total_count ?? 0);
  const oldestRecordingDate = rows[0]?.oldest_date ? new Date(rows[0].oldest_date).toISOString() : null;

  const maxStorageGb = env.RECORDING_MAX_STORAGE_GB ?? 5;
  const maxStorageBytes = maxStorageGb * 1024 * 1024 * 1024;
  const isStorageLimitExceeded = totalBytes >= maxStorageBytes;
  const warning = totalBytes >= maxStorageBytes * 0.85;

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const totalSizeFormatted = totalBytes > 1024 * 1024 * 1024
    ? `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : `${totalMb} MB`;
  const usagePercentage = Math.round((totalBytes / maxStorageBytes) * 10000) / 100;
  const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;

  return {
    totalBytes,
    totalSizeBytes: totalBytes,
    totalSizeFormatted,
    recordingsCount,
    totalRecordings: recordingsCount,
    oldestRecordingDate,
    oldestRecordingAt: oldestRecordingDate,
    maxStorageBytes,
    maxStorageGb,
    isStorageLimitExceeded,
    isExceeded: isStorageLimitExceeded,
    usagePercentage,
    warning,
    retentionDays,
  };
}

/**
 * Checks if new recording can start (storage safety limit check).
 */
export async function canStartRecording(): Promise<{ allowed: boolean; reason?: string }> {
  const stats = await getRecordingStorageStats();
  if (stats.isStorageLimitExceeded) {
    return {
      allowed: false,
      reason: `Recording storage limit reached (${stats.maxStorageGb} GB). Recording is suspended until storage is freed.`,
    };
  }
  return { allowed: true };
}

/**
 * Saves a chunk uploaded by student client to object storage (crash-recovery buffer).
 */
export async function saveRecordingChunk(params: {
  sessionId: number;
  examId: number;
  chunkIndex: number;
  buffer: Buffer;
}): Promise<{ chunkIndex: number; size: number }> {
  const { sessionId, examId, chunkIndex, buffer } = params;

  if (buffer.length === 0) {
    throw new AppError(400, 'EMPTY_CHUNK', 'Recording chunk buffer is empty');
  }

  // Size limit per chunk: 25MB
  if (buffer.length > 25 * 1024 * 1024) {
    throw new AppError(413, 'CHUNK_TOO_LARGE', 'Recording chunk exceeds maximum 25MB limit');
  }

  const chunkKey = resolveStorageKey(
    `recordings/${examId}/${sessionId}/chunks/chunk_${String(chunkIndex).padStart(6, '0')}.webm`
  );
  const adapter = getStorageAdapter();
  await adapter.put(chunkKey, buffer, { contentType: 'video/webm' });

  // Ensure Exam_Recordings row exists
  const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;
  const relativeFinalPath = resolveStorageKey(`recordings/${examId}/${sessionId}/recording.webm`);

  await executeSql(
    `INSERT INTO Exam_Recordings (session_id, file_path, status, expires_at)
     VALUES (?, ?, 'RECORDING', DATE_ADD(NOW(), INTERVAL ? DAY))
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [sessionId, relativeFinalPath, retentionDays]
  );

  return { chunkIndex, size: buffer.length };
}

/**
 * Option (b): Saves a single complete video file directly into object storage.
 * Direct client-to-storage completion without requiring ffmpeg.
 */
export async function saveCompleteRecording(params: {
  sessionId: number;
  examId: number;
  buffer: Buffer;
  durationMs: number;
}): Promise<ExamRecordingRow> {
  const { sessionId, examId, buffer, durationMs } = params;

  if (buffer.length === 0) {
    throw new AppError(400, 'EMPTY_RECORDING', 'Recording buffer is empty');
  }

  const relativeFinalPath = resolveStorageKey(`recordings/${examId}/${sessionId}/recording.webm`);
  const adapter = getStorageAdapter();
  await adapter.put(relativeFinalPath, buffer, { contentType: 'video/webm' });

  // Clean up any temporary chunks from storage
  const chunksPrefix = resolveStorageKey(`recordings/${examId}/${sessionId}/chunks/`);
  await adapter.deletePrefix(chunksPrefix).catch(() => {});

  const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;
  await executeSql(
    `INSERT INTO Exam_Recordings (session_id, file_path, mime_type, size_bytes, duration_ms, status, finished_at, expires_at)
     VALUES (?, ?, 'video/webm', ?, ?, 'READY', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
     ON DUPLICATE KEY UPDATE
       file_path = VALUES(file_path),
       mime_type = VALUES(mime_type),
       size_bytes = VALUES(size_bytes),
       duration_ms = VALUES(duration_ms),
       status = 'READY',
       finished_at = NOW(),
       expires_at = VALUES(expires_at),
       updated_at = NOW()`,
    [sessionId, relativeFinalPath, buffer.length, durationMs, retentionDays]
  );

  const rows = await queryRows<ExamRecordingRow[]>(
    'SELECT * FROM Exam_Recordings WHERE session_id = ?',
    [sessionId]
  );
  return rows[0];
}

/**
 * Finalizes the recording: verifies complete video or stitches uploaded chunks as fallback.
 */
export async function finishRecording(params: {
  sessionId: number;
  examId: number;
  clientDurationMs?: number;
}): Promise<ExamRecordingRow> {
  const { sessionId, examId, clientDurationMs = 0 } = params;
  const adapter = getStorageAdapter();
  const relativeFinalPath = resolveStorageKey(`recordings/${examId}/${sessionId}/recording.webm`);

  // Check if complete recording is already stored and READY
  const existingRows = await queryRows<ExamRecordingRow[]>(
    'SELECT * FROM Exam_Recordings WHERE session_id = ?',
    [sessionId]
  );
  if (existingRows[0] && existingRows[0].status === 'READY') {
    return existingRows[0];
  }

  // Crash-recovery fallback: check if chunks exist in storage
  const chunksPrefix = resolveStorageKey(`recordings/${examId}/${sessionId}/chunks/`);
  const chunkItems = (await adapter.list(chunksPrefix))
    .filter((item) => item.key.endsWith('.webm'))
    .sort((a, b) => a.key.localeCompare(b.key));

  if (chunkItems.length === 0) {
    const fileExists = await adapter.exists(relativeFinalPath);
    if (fileExists) {
      const stats = await adapter.get(relativeFinalPath);
      const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;
      await executeSql(
        `UPDATE Exam_Recordings
            SET file_path = ?,
                mime_type = 'video/webm',
                size_bytes = ?,
                duration_ms = ?,
                status = 'READY',
                finished_at = NOW(),
                expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
          WHERE session_id = ?`,
        [relativeFinalPath, stats.size, clientDurationMs, retentionDays, sessionId]
      );
      const rows = await queryRows<ExamRecordingRow[]>(
        'SELECT * FROM Exam_Recordings WHERE session_id = ?',
        [sessionId]
      );
      if (rows[0]) return rows[0];
    }

    await executeSql(
      `UPDATE Exam_Recordings SET status = 'FAILED', finished_at = NOW() WHERE session_id = ?`,
      [sessionId]
    );
    throw new AppError(400, 'NO_RECORDING_CHUNKS', 'Cannot finish recording: no video chunks received');
  }

  // Stream-stitch chunks directly into single object buffer
  const chunkBuffers: Buffer[] = [];
  for (const item of chunkItems) {
    const res = await adapter.get(item.key);
    const parts: Buffer[] = [];
    for await (const chunk of res.stream) {
      parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    chunkBuffers.push(Buffer.concat(parts));
  }

  const finalBuffer = Buffer.concat(chunkBuffers);
  await adapter.put(relativeFinalPath, finalBuffer, { contentType: 'video/webm' });

  // Clean up chunk objects from storage
  await adapter.deletePrefix(chunksPrefix).catch(() => {});

  const sizeBytes = finalBuffer.length;
  const durationMs = clientDurationMs || chunkItems.length * 10000;
  const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;

  await executeSql(
    `UPDATE Exam_Recordings
        SET file_path = ?,
            mime_type = 'video/webm',
            size_bytes = ?,
            duration_ms = ?,
            status = 'READY',
            finished_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
      WHERE session_id = ?`,
    [relativeFinalPath, sizeBytes, durationMs, retentionDays, sessionId]
  );

  const rows = await queryRows<ExamRecordingRow[]>(
    'SELECT * FROM Exam_Recordings WHERE session_id = ?',
    [sessionId]
  );
  return rows[0];
}

/**
 * Retrieves recording by ID.
 */
export async function getRecordingById(recordingId: number): Promise<ExamRecordingRow | null> {
  const rows = await queryRows<ExamRecordingRow[]>(
    'SELECT * FROM Exam_Recordings WHERE recording_id = ?',
    [recordingId]
  );
  return rows[0] ?? null;
}

/**
 * Retrieves recording by session ID.
 */
export async function getRecordingBySessionId(sessionId: number): Promise<ExamRecordingRow | null> {
  const rows = await queryRows<ExamRecordingRow[]>(
    'SELECT * FROM Exam_Recordings WHERE session_id = ?',
    [sessionId]
  );
  return rows[0] ?? null;
}

/**
 * Logs an access entry in Recording_Access_Log.
 */
export async function logRecordingAccess(params: {
  recordingId: number;
  userId: number;
  action?: 'VIEW' | 'DOWNLOAD';
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await executeSql(
    `INSERT INTO Recording_Access_Log (recording_id, user_id, action, ip_address, user_agent, viewed_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [params.recordingId, params.userId, params.action ?? 'VIEW', params.ipAddress ?? null, params.userAgent ?? null]
  );
}

/**
 * Retrieves notes for a recording.
 */
export async function getRecordingNotes(recordingId: number): Promise<RecordingNoteRow[]> {
  return queryRows<RecordingNoteRow[]>(
    `SELECT n.note_id, n.recording_id, n.author_id, u.full_name AS author_name,
            n.time_ms, n.text, n.created_at
       FROM Recording_Notes n
       JOIN Users u ON u.id = n.author_id
      WHERE n.recording_id = ?
      ORDER BY n.time_ms ASC, n.created_at ASC`,
    [recordingId]
  );
}

/**
 * Adds a new timestamped note to a recording.
 */
export async function addRecordingNote(params: {
  recordingId: number;
  authorId: number;
  timeMs: number;
  text: string;
}): Promise<RecordingNoteRow> {
  const timeMs = Math.max(0, Math.round(params.timeMs));
  const res = await executeSql(
    `INSERT INTO Recording_Notes (recording_id, author_id, time_ms, text, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [params.recordingId, params.authorId, timeMs, params.text.trim()]
  );
  const rows = await queryRows<RecordingNoteRow[]>(
    `SELECT n.note_id, n.recording_id, n.author_id, u.full_name AS author_name,
            n.time_ms, n.text, n.created_at
       FROM Recording_Notes n
       JOIN Users u ON u.id = n.author_id
      WHERE n.note_id = ?`,
    [res.insertId]
  );
  return rows[0];
}

/**
 * Deletes a note from a recording.
 */
export async function deleteRecordingNote(noteId: number, authorId: number, isAdmin: boolean): Promise<boolean> {
  let sql = 'DELETE FROM Recording_Notes WHERE note_id = ?';
  const sqlParams: (string | number)[] = [noteId];
  if (!isAdmin) {
    sql += ' AND author_id = ?';
    sqlParams.push(authorId);
  }
  const res = await executeSql(sql, sqlParams);
  return res.affectedRows > 0;
}

/**
 * Retrieves full review payload for the review player:
 * session details, recording metadata, violation & warning events, notes.
 */
export async function getRecordingReviewDetails(recordingId: number): Promise<RecordingReviewDetails | null> {
  const recordingRows = await queryRows<(ExamRecordingRow & { record_audio: number | boolean })[]>(
    `SELECT er.*, e.record_audio
       FROM Exam_Recordings er
       JOIN Exam_Sessions es ON es.id = er.session_id
       JOIN Exams e ON e.id = es.exam_id
      WHERE er.recording_id = ?`,
    [recordingId]
  );
  if (!recordingRows[0]) return null;

  const recRow = recordingRows[0];
  const sessionId = recRow.session_id;

  const sessionRows = await queryRows<RowDataPacket[]>(
    `SELECT es.id AS session_id, es.paper_code, es.started_at, es.ended_at AS finished_at,
            es.trust_score AS current_trust_score, es.status AS session_status, es.ip_address,
            u.full_name AS student_name, u.email AS student_email,
            e.id AS exam_id, e.title AS exam_title, e.min_trust_score
       FROM Exam_Sessions es
       JOIN Users u ON u.id = es.student_id
       JOIN Exams e ON e.id = es.exam_id
      WHERE es.id = ?`,
    [sessionId]
  );

  const sess = sessionRows[0] || {
    session_id: sessionId,
    paper_code: 'P000',
    started_at: recRow.started_at,
    finished_at: recRow.finished_at,
    current_trust_score: 100,
    session_status: 'COMPLETED',
    ip_address: null,
    student_name: 'Candidate',
    student_email: '',
    exam_id: 0,
    exam_title: 'Exam Assessment',
    min_trust_score: 50,
  };

  const sessionStartMs = new Date(sess.started_at).getTime();

  // Fetch violations
  const violationRows = await queryRows<RowDataPacket[]>(
    `SELECT log_id, violation_code, violation_label, penalty_applied, occurred_at,
            severity, proctor_review_status, snapshot_url, evidence_meta
       FROM vw_ViolationAuditReport
      WHERE session_id = ?
      ORDER BY occurred_at ASC`,
    [sessionId]
  );

  const violationEvents: ReviewTimelineEvent[] = violationRows.map((v) => {
    const rawSnap = v.snapshot_url as string | null | undefined;
    const signedSnap = generateSignedSnapshotUrl(rawSnap, v.log_id as number);
    const occurredMs = new Date(v.occurred_at).getTime();
    const timeMs = Math.max(0, occurredMs - sessionStartMs);
    return {
      id: `violation-${v.log_id}`,
      type: 'VIOLATION',
      code: v.violation_code,
      label: v.violation_label || v.violation_code,
      penalty: Number(v.penalty_applied || 0),
      timeMs,
      occurredAt: new Date(v.occurred_at).toISOString(),
      severity: v.severity,
      status: v.proctor_review_status,
      snapshotUrl: signedSnap,
    };
  });

  // Fetch warnings
  const warningRows = await queryRows<RowDataPacket[]>(
    `SELECT warning_id, message, issued_at, acknowledged_at, penalty_points, violation_code
       FROM Session_Warnings
      WHERE session_id = ?
      ORDER BY issued_at ASC`,
    [sessionId]
  );

  const warningEvents: ReviewTimelineEvent[] = warningRows.map((w, index) => {
    const issuedMs = new Date(w.issued_at).getTime();
    const timeMs = Math.max(0, issuedMs - sessionStartMs);
    return {
      id: `warning-${w.warning_id}`,
      type: 'WARNING',
      code: (w.violation_code as string) || `WARN_${index + 1}`,
      label: (w.message as string) || `Official Warning #${index + 1}`,
      penalty: Number(w.penalty_points || 0),
      timeMs,
      occurredAt: new Date(w.issued_at).toISOString(),
      severity: 'WARNING',
      status: w.acknowledged_at ? 'ACKNOWLEDGED' : 'PENDING',
    };
  });

  const allEvents = [...violationEvents, ...warningEvents].sort((a, b) => a.timeMs - b.timeMs);
  const notes = await getRecordingNotes(recordingId);

  return {
    recording: {
      ...recRow,
      has_audio: Boolean(recRow.record_audio),
    },
    session: {
      sessionId: sess.session_id,
      studentName: sess.student_name,
      studentEmail: sess.student_email,
      examTitle: sess.exam_title,
      examId: sess.exam_id,
      paperCode: sess.paper_code || 'P0001',
      startedAt: new Date(sess.started_at).toISOString(),
      finishedAt: sess.finished_at ? new Date(sess.finished_at).toISOString() : null,
      currentTrustScore: Number(sess.current_trust_score ?? 100),
      minTrustScore: Number(sess.min_trust_score ?? 50),
      sessionStatus: sess.session_status,
      ipAddress: sess.ip_address ?? null,
    },
    events: allEvents,
    notes,
  };
}

/**
 * Deletes recording files from storage and database entry (Admin manual delete).
 */
export async function deleteRecording(recordingId: number): Promise<boolean> {
  const rec = await getRecordingById(recordingId);
  if (!rec) return false;

  const adapter = getStorageAdapter();
  if (rec.file_path) {
    await adapter.delete(rec.file_path).catch(() => {});
    const parentDir = rec.file_path.replace(/\/?[^/]+$/, '');
    if (parentDir) {
      await adapter.deletePrefix(`${parentDir}/`).catch(() => {});
    }
  }

  await executeSql('DELETE FROM Exam_Recordings WHERE recording_id = ?', [recordingId]);
  return true;
}

/**
 * Toggles legal hold on recording.
 */
export async function setLegalHold(recordingId: number, hold: boolean): Promise<boolean> {
  const res = await executeSql(
    'UPDATE Exam_Recordings SET legal_hold = ? WHERE recording_id = ?',
    [hold ? 1 : 0, recordingId]
  );
  return res.affectedRows > 0;
}

/**
 * Nightly/scheduled cleanup for expired recordings.
 * Respects legal_hold and protects sessions with confirmed violations or disqualification.
 * Deletes storage objects as well as database rows.
 */
export async function cleanupExpiredRecordings(): Promise<number> {
  // Query recordings eligible for deletion
  const eligible = await queryRows<ExamRecordingRow[]>(
    `SELECT er.*
       FROM Exam_Recordings er
       JOIN Exam_Sessions es ON es.id = er.session_id
      WHERE er.expires_at <= NOW()
        AND er.legal_hold = 0
        AND es.status != 'TERMINATED_CHEATING'
        AND NOT EXISTS (
          SELECT 1 FROM Proctoring_Logs pl
           WHERE pl.session_id = es.id
             AND pl.proctor_review_status = 'CONFIRMED'
        )`
  );

  let deletedCount = 0;
  for (const rec of eligible) {
    const success = await deleteRecording(rec.recording_id);
    if (success) deletedCount++;
  }

  return deletedCount;
}
