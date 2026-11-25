import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getRealtimeAdapter, PollingRealtimeAdapter } from '../realtime/adapter.js';
import { getDefaultUserChannels, isUserAuthorizedForChannel } from '../realtime/channels.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const realtimeRouter = Router();

const pusherAuthSchema = z.object({
  socket_id: z.string().min(1, 'socket_id is required'),
  channel_name: z.string().min(1, 'channel_name is required'),
});

export const getEventsQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  channels: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * GET /api/realtime/config
 * Provides client with active provider information and public keys.
 */
realtimeRouter.get('/config', (_req, res) => {
  sendSuccess(res, {
    provider: env.REALTIME_PROVIDER,
    pusher:
      env.REALTIME_PROVIDER === 'pusher'
        ? {
            key: env.PUSHER_KEY || '',
            cluster: env.PUSHER_CLUSTER || 'mt1',
          }
        : null,
  });
});

/**
 * POST /api/realtime/auth
 * Pusher private channel authorization endpoint.
 * Validates JWT, verifies channel permission, and signs the auth payload.
 */
realtimeRouter.post(
  '/auth',
  requireAuth,
  validate({ body: pusherAuthSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { socket_id, channel_name } = req.body as z.infer<typeof pusherAuthSchema>;
      const user = req.user;
      if (!user) {
        sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
        return;
      }

      const isAuthorized = await isUserAuthorizedForChannel(user, channel_name);
      if (!isAuthorized) {
        sendError(res, 403, 'FORBIDDEN', `Forbidden: You do not have permission to join channel '${channel_name}'.`);
        return;
      }

      const adapter = getRealtimeAdapter();
      if (typeof adapter.authorizeChannel === 'function') {
        const authData = await adapter.authorizeChannel(socket_id, channel_name, user);
        res.json(authData);
        return;
      }

      // Fallback response if not running full Pusher instance (e.g. testing)
      res.json({
        auth: `${env.PUSHER_KEY || 'mock-key'}:mock-auth-signature-${socket_id}-${channel_name}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/events
 * Polling fallback endpoint backed by Events table.
 * Supports cursor-based retrieval (?since=123) and channel filtering.
 */
export async function handleGetEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { since, channels, limit } = req.query as unknown as z.infer<typeof getEventsQuerySchema>;
    const user = req.user;
    if (!user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    let targetChannels: string[] = [];

    if (channels && typeof channels === 'string') {
      const requested = channels
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      // Verify each requested channel
      const checks = await Promise.all(
        requested.map(async (ch) => ({ ch, allowed: await isUserAuthorizedForChannel(user, ch) }))
      );

      targetChannels = checks.filter((c) => c.allowed).map((c) => c.ch);

      // If user specifically requested channels and none were allowed, return 403 Forbidden
      if (requested.length > 0 && targetChannels.length === 0) {
        sendError(res, 403, 'FORBIDDEN', 'Forbidden: Not authorized for any of the requested channels.');
        return;
      }
    } else {
      // Default authorized channels for user role
      targetChannels = getDefaultUserChannels(user);
    }

    const polling = new PollingRealtimeAdapter();
    const result = await polling.getEvents(targetChannels, since, limit);

    sendSuccess(res, {
      events: result.events,
      cursor: result.cursor,
      channels: targetChannels,
    });
  } catch (err) {
    next(err);
  }
}

realtimeRouter.get(
  '/events',
  requireAuth,
  validate({ query: getEventsQuerySchema }),
  handleGetEvents
);
