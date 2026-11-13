import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response.js';

const DEBOUNCE_MS = 3000;
const recentViolations = new Map<string, number>();

export function shouldDebounceViolation(
  sessionId: number,
  code: string,
  nowMs = Date.now(),
  windowMs = DEBOUNCE_MS
): boolean {
  const key = `${sessionId}:${code}`;
  const lastSeen = recentViolations.get(key);
  if (lastSeen !== undefined && nowMs - lastSeen < windowMs) {
    return true;
  }

  recentViolations.set(key, nowMs);

  // Opportunistic prune to keep map bounded
  if (recentViolations.size > 2000) {
    for (const [entryKey, ts] of recentViolations.entries()) {
      if (nowMs - ts >= windowMs) {
        recentViolations.delete(entryKey);
      }
    }
  }

  return false;
}

export function clearViolationDebounceCache(): void {
  recentViolations.clear();
}

export const violationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      429,
      'RATE_LIMITED',
      'Too many violation telemetry requests. Maximum 30 events per minute.'
    );
  },
});

