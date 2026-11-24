import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

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
 * Returns root directory for recordings in current environment.
 */
export function getRecordingsBaseDir(): string {
  const base = path.resolve(process.cwd(), env.UPLOADS_DIR, 'recordings');
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  return base;
}

/**
 * Returns directory for specific session recording and its chunks.
 */
export function getSessionRecordingDir(examId: number, sessionId: number): string {
  const sessionDir = path.join(getRecordingsBaseDir(), String(examId), String(sessionId));
  const chunksDir = path.join(sessionDir, 'chunks');
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }
  return sessionDir;
}

/**
 * Computes disk usage and storage statistics.
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
 * Checks if new recording can start (disk safety limit check).
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
 * Saves a chunk uploaded by student client.
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

  const sessionDir = getSessionRecordingDir(examId, sessionId);
  const chunkPath = path.join(sessionDir, 'chunks', `chunk_${String(chunkIndex).padStart(6, '0')}.webm`);

  await fs.promises.writeFile(chunkPath, buffer);

  // Ensure Exam_Recordings row exists
  const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;
  const relativeFinalPath = path.join('recordings', String(examId), String(sessionId), 'recording.webm').replace(/\\/g, '/');

  await executeSql(
    `INSERT INTO Exam_Recordings (session_id, file_path, status, expires_at)
     VALUES (?, ?, 'RECORDING', DATE_ADD(NOW(), INTERVAL ? DAY))
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [sessionId, relativeFinalPath, retentionDays]
  );

  return { chunkIndex, size: buffer.length };
}

/**
 * Remuxes concatenated WebM using ffmpeg-static to inject EBML duration & cue points.
 */
async function remuxWithFfmpeg(inputPath: string, outputPath: string): Promise<number | null> {
  const binaryPath = typeof ffmpegStatic === 'string'
    ? ffmpegStatic
    : (ffmpegStatic as { default?: string } | undefined)?.default;
  if (!binaryPath || !fs.existsSync(binaryPath)) {
    console.warn('[RecordingService] ffmpeg-static binary not found, skipping remux');
    return null;
  }

  return new Promise<number | null>((resolve) => {
    // -c copy: remux without re-encoding (instant fast copy)
    const proc = spawn(binaryPath, [
      '-y',
      '-i',
      inputPath,
      '-c',
      'copy',
      outputPath,
    ]);

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', (code: number | null) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        // Try to parse duration from ffmpeg output: Duration: 00:00:10.50
        const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (match) {
          const hours = Number(match[1]);
          const mins = Number(match[2]);
          const secs = Number(match[3]);
          const ms = Math.round((hours * 3600 + mins * 60 + secs) * 1000);
          resolve(ms);
          return;
        }
        resolve(null);
      } else {
        console.warn('[RecordingService] ffmpeg remux exited with code', code, stderr);
        resolve(null);
      }
    });

    proc.on('error', (err: Error) => {
      console.warn('[RecordingService] ffmpeg process error:', err.message);
      resolve(null);
    });
  });
}

/**
 * Concatenates all uploaded chunks and finalizes the recording.
 */
export async function finishRecording(params: {
  sessionId: number;
  examId: number;
  clientDurationMs?: number;
}): Promise<ExamRecordingRow> {
  const { sessionId, examId, clientDurationMs = 0 } = params;
  const sessionDir = getSessionRecordingDir(examId, sessionId);
  const chunksDir = path.join(sessionDir, 'chunks');

  if (!fs.existsSync(chunksDir)) {
    throw new AppError(404, 'RECORDING_NOT_FOUND', 'No recording chunks found for this session');
  }

  const chunkFiles = (await fs.promises.readdir(chunksDir))
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.webm'))
    .sort();

  if (chunkFiles.length === 0) {
    // If no chunks recorded, mark as FAILED
    await executeSql(
      `UPDATE Exam_Recordings SET status = 'FAILED', finished_at = NOW() WHERE session_id = ?`,
      [sessionId]
    );
    throw new AppError(400, 'NO_RECORDING_CHUNKS', 'Cannot finish recording: no video chunks received');
  }

  const rawConcatenatedPath = path.join(sessionDir, 'raw_concat.webm');
  const finalWebmPath = path.join(sessionDir, 'recording.webm');

  // Concatenate all chunks into raw file
  const writeStream = fs.createWriteStream(rawConcatenatedPath);
  for (const file of chunkFiles) {
    const chunkFilePath = path.join(chunksDir, file);
    const chunkBuffer = await fs.promises.readFile(chunkFilePath);
    writeStream.write(chunkBuffer);
  }
  await new Promise<void>((resolve, reject) => {
    writeStream.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Remux with ffmpeg to ensure valid duration and seekable WebM cues
  let remuxedDurationMs: number | null = null;
  try {
    remuxedDurationMs = await remuxWithFfmpeg(rawConcatenatedPath, finalWebmPath);
  } catch (err) {
    console.warn('[RecordingService] ffmpeg remux error:', err);
  }

  // If remux did not produce file, fallback to raw concatenated file
  if (!fs.existsSync(finalWebmPath)) {
    await fs.promises.copyFile(rawConcatenatedPath, finalWebmPath);
  }

  // Clean up raw concat and chunks
  await fs.promises.unlink(rawConcatenatedPath).catch(() => {});
  for (const file of chunkFiles) {
    await fs.promises.unlink(path.join(chunksDir, file)).catch(() => {});
  }
  await fs.promises.rmdir(chunksDir).catch(() => {});

  const stats = await fs.promises.stat(finalWebmPath);
  const sizeBytes = stats.size;
  const durationMs = remuxedDurationMs ?? clientDurationMs ?? 0;

  const retentionDays = env.RECORDING_RETENTION_DAYS ?? 30;
  const relativeFinalPath = path.join('recordings', String(examId), String(sessionId), 'recording.webm').replace(/\\/g, '/');

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
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await executeSql(
    `INSERT INTO Recording_Access_Log (recording_id, user_id, ip_address, user_agent, viewed_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [params.recordingId, params.userId, params.ipAddress ?? null, params.userAgent ?? null]
  );
}

/**
 * Deletes recording files and database entry (Admin manual delete).
 */
export async function deleteRecording(recordingId: number): Promise<boolean> {
  const rec = await getRecordingById(recordingId);
  if (!rec) return false;

  const absolutePath = path.resolve(process.cwd(), env.UPLOADS_DIR, rec.file_path);
  if (fs.existsSync(absolutePath)) {
    await fs.promises.unlink(absolutePath).catch(() => {});
    const parentDir = path.dirname(absolutePath);
    await fs.promises.rm(parentDir, { recursive: true, force: true }).catch(() => {});
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
