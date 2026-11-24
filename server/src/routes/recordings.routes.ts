import fs from 'fs';
import path from 'path';
import { Router, type Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { queryRows } from '../config/db.js';
import { requireAuth, requireRole, verifyJwtToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addRecordingNote,
  canStartRecording,
  cleanupExpiredRecordings,
  deleteRecording,
  deleteRecordingNote,
  finishRecording,
  getRecordingById,
  getRecordingBySessionId,
  getRecordingNotes,
  getRecordingReviewDetails,
  getRecordingStorageStats,
  logRecordingAccess,
  saveRecordingChunk,
  setLegalHold,
} from '../services/recordingService.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import type { ExamSessionRow, JwtUserPayload } from '../types/api.js';

export const recordingsRouter = Router();

const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
});

const chunkParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  index: z.coerce.number().int().min(0),
});

const recordingIdParamSchema = z.object({
  recordingId: z.coerce.number().int().positive(),
});

const finishRecordingSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
});

const legalHoldSchema = z.object({
  legalHold: z.boolean(),
});

const createNoteSchema = z.object({
  timeMs: z.number().int().nonnegative(),
  text: z.string().min(1).max(2000),
});

const noteIdParamSchema = z.object({
  recordingId: z.coerce.number().int().positive(),
  noteId: z.coerce.number().int().positive(),
});

// Helper to check session ownership
async function assertSessionAccess(req: AuthenticatedRequest, sessionId: number): Promise<ExamSessionRow> {
  const rows = await queryRows<ExamSessionRow[]>(
    'SELECT * FROM Exam_Sessions WHERE id = ?',
    [sessionId]
  );
  const session = rows[0];
  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found');
  }

  if (req.user!.role === 'STUDENT' && Number(session.student_id) !== Number(req.user!.sub)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this exam session');
  }

  return session;
}

/**
 * PUT /api/sessions/:sessionId/recording/chunks/:index
 * Uploads an individual video chunk (approx 10s timeslice).
 */
recordingsRouter.put(
  '/sessions/:sessionId/recording/chunks/:index',
  requireAuth,
  validate({ params: chunkParamSchema }),
  express.raw({ type: ['video/webm', 'application/octet-stream', '*/*'], limit: '30mb' }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId, index } = req.params as unknown as z.infer<typeof chunkParamSchema>;
      const session = await assertSessionAccess(req, sessionId);

      // Check disk safety guard on initial chunk
      if (index === 0) {
        const canStart = await canStartRecording();
        if (!canStart.allowed) {
          throw new AppError(507, 'INSUFFICIENT_STORAGE', canStart.reason ?? 'Storage limit reached');
        }
      }

      const buffer = req.body instanceof Buffer ? req.body : Buffer.from(req.body || '');
      if (buffer.length === 0) {
        throw new AppError(400, 'EMPTY_CHUNK', 'Chunk payload is empty');
      }

      const result = await saveRecordingChunk({
        sessionId,
        examId: session.exam_id,
        chunkIndex: index,
        buffer,
      });

      sendSuccess(res, {
        uploaded: true,
        chunkIndex: result.chunkIndex,
        bytes: result.size,
      }, 200);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/sessions/:sessionId/recording/finish
 * Assembles chunks, remuxes with ffmpeg, and finalizes recording.
 */
recordingsRouter.post(
  '/sessions/:sessionId/recording/finish',
  requireAuth,
  validate({ params: sessionIdParamSchema, body: finishRecordingSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const body = req.body as z.infer<typeof finishRecordingSchema>;
      const session = await assertSessionAccess(req, sessionId);

      const recording = await finishRecording({
        sessionId,
        examId: session.exam_id,
        clientDurationMs: body.durationMs,
      });

      sendSuccess(res, {
        recordingId: recording.recording_id,
        sessionId: recording.session_id,
        status: recording.status,
        durationMs: recording.duration_ms,
        sizeBytes: recording.size_bytes,
        expiresAt: recording.expires_at,
      }, 200);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Helper for authenticated video streaming (supports Range requests & query token).
 */
function authenticateStreamRequest(req: AuthenticatedRequest): JwtUserPayload {
  // 1. Header token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifyJwtToken(token);
  }

  // 2. Query parameter token (for standard HTML5 <video src="/api/recordings/:id/stream?token=...">)
  const queryToken = req.query.token as string | undefined;
  if (queryToken && queryToken.trim()) {
    return verifyJwtToken(queryToken.trim());
  }

  throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required to stream recording');
}

/**
 * GET /api/recordings/:recordingId/stream
 * Serves video recording with HTTP 206 Partial Content Range support.
 * Restricted to ADMIN and PROCTOR only.
 */
recordingsRouter.get(
  '/recordings/:recordingId/stream',
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const user = authenticateStreamRequest(req);
      if (user.role !== 'ADMIN' && user.role !== 'PROCTOR') {
        throw new AppError(403, 'FORBIDDEN', 'Recordings can only be viewed by authorized staff');
      }

      const recordingId = Number(req.params.recordingId);
      if (!recordingId || isNaN(recordingId)) {
        throw new AppError(400, 'INVALID_RECORDING_ID', 'Invalid recording ID parameter');
      }

      const recording = await getRecordingById(recordingId);
      if (!recording || recording.status !== 'READY') {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'Recording not found or not ready');
      }

      const absolutePath = path.resolve(process.cwd(), env.UPLOADS_DIR, recording.file_path);
      if (!fs.existsSync(absolutePath)) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Recording video file missing on disk');
      }

      // Audit view in Recording_Access_Log
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
      const ua = req.headers['user-agent'] || null;
      void logRecordingAccess({
        recordingId,
        userId: Number(user.sub),
        ipAddress: ip,
        userAgent: ua,
      });

      const stat = await fs.promises.stat(absolutePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', recording.mime_type || 'video/webm');

      if (range) {
        // Range: bytes=start-end
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          res.status(416).end();
          return;
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(absolutePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize,
        });

        fileStream.pipe(res);
      } else {
        res.setHeader('Content-Length', fileSize);
        res.status(200);
        fs.createReadStream(absolutePath).pipe(res);
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/recordings/:recordingId
 * Metadata for single recording.
 */
recordingsRouter.get(
  '/recordings/:recordingId',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: recordingIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const recording = await getRecordingById(recordingId);
      if (!recording) {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'Recording not found');
      }
      sendSuccess(res, recording);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/recordings/:recordingId/review
 * Full review metadata: session info, timeline events (violations/warnings), notes.
 */
recordingsRouter.get(
  '/recordings/:recordingId/review',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: recordingIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const details = await getRecordingReviewDetails(recordingId);
      if (!details) {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'Recording not found for review');
      }
      sendSuccess(res, details);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/recordings/:recordingId/notes
 * List proctor/admin timestamped notes.
 */
recordingsRouter.get(
  '/recordings/:recordingId/notes',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: recordingIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const notes = await getRecordingNotes(recordingId);
      sendSuccess(res, notes);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/recordings/:recordingId/notes
 * Add a timestamped note.
 */
recordingsRouter.post(
  '/recordings/:recordingId/notes',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: recordingIdParamSchema, body: createNoteSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const { timeMs, text } = req.body as z.infer<typeof createNoteSchema>;
      const authorId = Number(req.user!.sub);
      const note = await addRecordingNote({
        recordingId,
        authorId,
        timeMs,
        text,
      });
      sendSuccess(res, note, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/recordings/:recordingId/notes/:noteId
 * Delete a note (author or Admin).
 */
recordingsRouter.delete(
  '/recordings/:recordingId/notes/:noteId',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: noteIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { noteId } = req.params as unknown as z.infer<typeof noteIdParamSchema>;
      const authorId = Number(req.user!.sub);
      const isAdmin = req.user!.role === 'ADMIN';
      const deleted = await deleteRecordingNote(noteId, authorId, isAdmin);
      if (!deleted) {
        throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found or permission denied');
      }
      sendSuccess(res, { deleted: true, noteId });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/recordings/:recordingId/view
 * Explicitly log playback start event.
 */
recordingsRouter.post(
  '/recordings/:recordingId/view',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: recordingIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const ua = req.headers['user-agent'];
      await logRecordingAccess({
        recordingId,
        userId: Number(req.user!.sub),
        action: 'VIEW',
        ipAddress: ip,
        userAgent: ua,
      });
      sendSuccess(res, { logged: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/recordings/:recordingId/download
 * Admin download with audit log entry.
 */
recordingsRouter.get(
  '/recordings/:recordingId/download',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: recordingIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const rec = await getRecordingById(recordingId);
      if (!rec) {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'Recording not found');
      }

      const absolutePath = path.resolve(process.cwd(), env.UPLOADS_DIR, rec.file_path);
      if (!fs.existsSync(absolutePath)) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Physical video file is missing');
      }

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const ua = req.headers['user-agent'];
      await logRecordingAccess({
        recordingId,
        userId: Number(req.user!.sub),
        action: 'DOWNLOAD',
        ipAddress: ip,
        userAgent: ua,
      });

      const filename = `recording-session-${rec.session_id}.webm`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', rec.mime_type || 'video/webm');
      fs.createReadStream(absolutePath).pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/recordings/session/:sessionId
 * Metadata for recording linked to session.
 */
recordingsRouter.get(
  '/recordings/session/:sessionId',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: sessionIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const recording = await getRecordingBySessionId(sessionId);
      if (!recording) {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'No recording found for this session');
      }
      sendSuccess(res, recording);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/recordings/:recordingId
 * Manually delete recording (Admin only).
 */
recordingsRouter.delete(
  '/recordings/:recordingId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: recordingIdParamSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const deleted = await deleteRecording(recordingId);
      if (!deleted) {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'Recording not found or already deleted');
      }
      sendSuccess(res, { deleted: true, recordingId });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/recordings/:recordingId/legal-hold
 * Toggle legal hold (Admin only).
 */
recordingsRouter.patch(
  '/recordings/:recordingId/legal-hold',
  requireAuth,
  requireRole('ADMIN', 'PROCTOR'),
  validate({ params: recordingIdParamSchema, body: legalHoldSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { recordingId } = req.params as unknown as z.infer<typeof recordingIdParamSchema>;
      const { legalHold } = req.body as z.infer<typeof legalHoldSchema>;
      const updated = await setLegalHold(recordingId, legalHold);
      if (!updated) {
        throw new AppError(404, 'RECORDING_NOT_FOUND', 'Recording not found');
      }
      sendSuccess(res, { recordingId, legalHold });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/recordings/storage
 * Disk safety statistics (Admin only).
 */
recordingsRouter.get(
  '/admin/recordings/storage',
  requireAuth,
  requireRole('ADMIN'),
  async (_req, res, next) => {
    try {
      const stats = await getRecordingStorageStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/recordings/cleanup
 * Trigger nightly retention cleanup job (Admin only).
 */
recordingsRouter.post(
  '/admin/recordings/cleanup',
  requireAuth,
  requireRole('ADMIN'),
  async (_req, res, next) => {
    try {
      const deletedCount = await cleanupExpiredRecordings();
      sendSuccess(res, { cleaned: true, deletedCount });
    } catch (err) {
      next(err);
    }
  }
);
