import { Router, type Request, type Response, type NextFunction } from 'express';
import { env } from '../config/env.js';
import { runAutoTimeoutSweep } from '../services/timeoutService.js';
import { cleanupExpiredRecordings } from '../services/recordingService.js';
import { purgeOldEvents } from '../realtime/adapter.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const cronRouter = Router();

/**
 * Middleware: Verify Bearer token against CRON_SECRET.
 * Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>`.
 * Rejects requests with missing or invalid token with HTTP 401.
 */
function verifyCronSecret(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cronSecret = env.CRON_SECRET;

  if (!cronSecret) {
    sendError(res, 500, 'CRON_NOT_CONFIGURED', 'CRON_SECRET is not configured on the server.');
    return;
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid CRON_SECRET bearer authorization.');
    return;
  }

  next();
}

cronRouter.use(verifyCronSecret);

/**
 * GET/POST /api/cron/timeouts
 * Housekeeping sweep: times out expired sessions past deadline + grace and finalizes grading.
 */
const handleTimeouts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const processed = await runAutoTimeoutSweep();
    sendSuccess(res, {
      message: 'Timeout sweep completed.',
      timedOutSessionsProcessed: processed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};
cronRouter.get('/timeouts', handleTimeouts);
cronRouter.post('/timeouts', handleTimeouts);

/**
 * GET/POST /api/cron/retention
 * Housekeeping retention: cleans up expired recordings and deletes objects from object storage.
 */
const handleRetention = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deletedCount = await cleanupExpiredRecordings();
    sendSuccess(res, {
      message: 'Retention cleanup completed.',
      deletedRecordings: deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};
cronRouter.get('/retention', handleRetention);
cronRouter.post('/retention', handleRetention);

/**
 * GET/POST /api/cron/events-cleanup
 * Housekeeping events: purges realtime polling events older than 10 minutes.
 */
const handleEventsCleanup = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await purgeOldEvents(true);
    sendSuccess(res, {
      message: 'Realtime events cleanup completed.',
      purged: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};
cronRouter.get('/events-cleanup', handleEventsCleanup);
cronRouter.post('/events-cleanup', handleEventsCleanup);
