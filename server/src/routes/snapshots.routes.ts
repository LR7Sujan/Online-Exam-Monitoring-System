import { Router, type Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import { queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getStorageAdapter } from '../storage/index.js';
import { verifySignedSnapshotUrl } from '../services/snapshotSigner.js';
import { sendError } from '../utils/response.js';

export const snapshotsRouter = Router();

/**
 * GET /api/snapshots/signed
 * Serves a snapshot via a short-lived HMAC-signed authorization URL.
 */
snapshotsRouter.get('/signed', async (req, res, next) => {
  try {
    const key = (req.query.key as string) || '';
    if (!key) {
      sendError(res, 400, 'MISSING_SNAPSHOT_KEY', 'Snapshot key is required.');
      return;
    }

    const verifyResult = verifySignedSnapshotUrl(key, {
      expires: typeof req.query.expires === 'string' ? req.query.expires : undefined,
      logId: typeof req.query.logId === 'string' ? req.query.logId : undefined,
      sig: typeof req.query.sig === 'string' ? req.query.sig : undefined,
    });

    if (!verifyResult.valid) {
      sendError(
        res,
        401,
        verifyResult.code ?? 'INVALID_SNAPSHOT_SIGNATURE',
        verifyResult.message ?? 'Invalid signed snapshot URL.'
      );
      return;
    }

    const adapter = getStorageAdapter();
    const result = await adapter.get(key);

    res.setHeader('Content-Type', result.contentType || 'image/jpeg');
    res.setHeader('Content-Length', result.size);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes cache
    result.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * Middleware: Verify JWT and enforce IDOR / RBAC checks on snapshot access
 */
async function authenticateSnapshotAccess(req: AuthenticatedRequest, res: Response, key: string): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    (req.query.token as string);

  if (!token) {
    sendError(res, 401, 'UNAUTHORIZED_SNAPSHOT_ACCESS', 'Authentication token required to view forensic snapshot.');
    return false;
  }

  let decoded: { sub?: number; role?: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: number; role?: string };
  } catch {
    sendError(res, 401, 'INVALID_SNAPSHOT_TOKEN', 'Invalid or expired snapshot authorization token.');
    return false;
  }

  // PROCTOR and ADMIN have global access
  if (decoded.role === 'PROCTOR' || decoded.role === 'ADMIN') {
    return true;
  }

  // STUDENT role: verify IDOR session ownership
  if (decoded.role === 'STUDENT' && decoded.sub) {
    // Check if key contains sessionId: e.g. snapshots/123/... or test/snapshots/123/... or snapshot-123-...
    const match = key.match(/(?:snapshots\/|snapshot-)(\d+)[-/]/);
    if (match) {
      const sessionId = Number(match[1]);
      const rows = await queryRows<RowDataPacket[]>(
        'SELECT student_id FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      if (rows[0] && Number(rows[0].student_id) === Number(decoded.sub)) {
        return true;
      }
    }
  }

  sendError(
    res,
    403,
    'FORBIDDEN',
    'Forensic snapshots are restricted to authorized proctors and the verified session examinee.'
  );
  return false;
}

/**
 * GET /api/snapshots/:key(*)
 * Token-authenticated proxy route for object storage snapshots.
 */
snapshotsRouter.get('/:key(*)', async (req: AuthenticatedRequest, res, next) => {
  try {
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
    if (!key) {
      sendError(res, 400, 'MISSING_SNAPSHOT_KEY', 'Snapshot key is required.');
      return;
    }

    const isAllowed = await authenticateSnapshotAccess(req, res, key);
    if (!isAllowed) return;

    const adapter = getStorageAdapter();
    const result = await adapter.get(key);

    res.setHeader('Content-Type', result.contentType || 'image/jpeg');
    res.setHeader('Content-Length', result.size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    result.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});
