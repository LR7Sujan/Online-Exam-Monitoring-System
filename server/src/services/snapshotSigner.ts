import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface VerifySignedUrlResult {
  valid: boolean;
  code?: 'EXPIRED_SNAPSHOT_URL' | 'INVALID_SNAPSHOT_SIGNATURE';
  message?: string;
}

/**
 * Generates an HMAC-SHA256 signed snapshot URL with 5-minute expiry bound to the log ID
 */
export function generateSignedSnapshotUrl(
  snapshotPath: string | null | undefined,
  logId?: number | null,
  expiresInSeconds = 300 // 5 minutes
): string | null {
  if (!snapshotPath) return null;
  // If external absolute URL (e.g. S3 presigned URL directly), return as is
  if (snapshotPath.startsWith('http://') || snapshotPath.startsWith('https://')) {
    return snapshotPath;
  }

  // Clean any existing query params from path
  const [cleanPath] = snapshotPath.split('?');
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const boundLogId = logId ?? '';
  const dataToSign = `${cleanPath}:${expires}:${boundLogId}`;

  const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(dataToSign).digest('hex');

  const queryParams = new URLSearchParams();
  queryParams.set('expires', String(expires));
  if (boundLogId) {
    queryParams.set('logId', String(boundLogId));
  }
  queryParams.set('sig', sig);

  // If path is a storage key (e.g. snapshots/...), return /api/snapshots/signed endpoint
  if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('/')) {
    queryParams.set('key', cleanPath);
    return `/api/snapshots/signed?${queryParams.toString()}`;
  }

  return `${cleanPath}?${queryParams.toString()}`;
}

/**
 * Verifies that a signed snapshot URL has a valid HMAC signature and has not expired
 */
export function verifySignedSnapshotUrl(
  cleanPath: string,
  query: { expires?: string; logId?: string; sig?: string }
): VerifySignedUrlResult {
  const { expires, logId, sig } = query;

  if (!expires || !sig) {
    return {
      valid: false,
      code: 'INVALID_SNAPSHOT_SIGNATURE',
      message: 'Missing signed snapshot authorization parameters.',
    };
  }

  const expNum = Number(expires);
  if (!Number.isFinite(expNum) || expNum <= 0) {
    return {
      valid: false,
      code: 'INVALID_SNAPSHOT_SIGNATURE',
      message: 'Invalid snapshot expiry timestamp.',
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > expNum) {
    return {
      valid: false,
      code: 'EXPIRED_SNAPSHOT_URL',
      message: 'Signed snapshot authorization URL has expired.',
    };
  }

  const boundLogId = logId ?? '';
  const dataToSign = `${cleanPath}:${expires}:${boundLogId}`;
  const expectedSig = crypto.createHmac('sha256', env.JWT_SECRET).update(dataToSign).digest('hex');

  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return {
      valid: false,
      code: 'INVALID_SNAPSHOT_SIGNATURE',
      message: 'Invalid snapshot signature.',
    };
  }

  return { valid: true };
}
