import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import swaggerUi from 'swagger-ui-express';
import { queryRows, getDbHealth } from './config/db.js';
import { verifySignedSnapshotUrl } from './services/snapshotSigner.js';
import { env } from './config/env.js';
import { openApiSpec } from './docs/openapi.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { validate } from './middleware/validate.js';
import { simulatorEngine } from './services/simulator.js';
import { adminRouter } from './routes/admin.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { examsRouter } from './routes/exams.routes.js';
import { extensionsRouter } from './routes/extensions.routes.js';
import { logsRouter } from './routes/logs.routes.js';
import { monitorRouter } from './routes/monitor.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { proctorRouter } from './routes/proctor.routes.js';
import { sessionsRouter } from './routes/sessions.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { studentsRouter } from './routes/students.routes.js';
import { recordingsRouter } from './routes/recordings.routes.js';
import { realtimeRouter, handleGetEvents, getEventsQuerySchema } from './routes/realtime.routes.js';
import { violationsRouter } from './routes/violations.routes.js';
import { violationTypesRouter } from './routes/violationTypes.routes.js';
import { snapshotsRouter } from './routes/snapshots.routes.js';
import { getStorageAdapter, resolveStorageKey } from './storage/index.js';
import { sendSuccess } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve uploads directory relative to project root or script location
const projectRootDir = path.resolve(__dirname, '../../');
export const serverUploadsDir = env.UPLOADS_DIR
  ? path.resolve(projectRootDir, env.UPLOADS_DIR)
  : path.resolve(__dirname, '../uploads');

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );
  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));

  // Protected snapshots proxy route: requires valid signed URL (HMAC 5-min expiry) OR valid JWT with RBAC/IDOR checks
  // Streams forensic snapshot from StorageAdapter without static filesystem serving
  app.use(
    '/uploads',
    async (req, res) => {
      // 1. Short-lived signed URL access (HMAC 5-minute expiry, bound to logId/path)
      if (req.query.sig || req.query.expires) {
        const fullUploadPath = `/uploads${req.path.startsWith('/') ? req.path : `/${req.path}`}`;
        const verifyResult = verifySignedSnapshotUrl(fullUploadPath, {
          expires: typeof req.query.expires === 'string' ? req.query.expires : undefined,
          logId: typeof req.query.logId === 'string' ? req.query.logId : undefined,
          sig: typeof req.query.sig === 'string' ? req.query.sig : undefined,
        });

        if (!verifyResult.valid) {
          res.status(401).json({
            success: false,
            data: null,
            error: {
              code: verifyResult.code ?? 'INVALID_SNAPSHOT_SIGNATURE',
              message: verifyResult.message ?? 'Invalid signed snapshot authorization URL.',
            },
          });
          return;
        }
      } else {
        // 2. Token-based access (Bearer header or ?token=)
        const authHeader = req.headers.authorization;
        const token =
          (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
          (req.query.token as string);

        if (!token) {
          res.status(401).json({
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED_SNAPSHOT_ACCESS',
              message: 'Authentication token required to view forensic snapshot evidence.',
            },
          });
          return;
        }

        try {
          const decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: number; role?: string };
          let allowed = decoded.role === 'PROCTOR' || decoded.role === 'ADMIN';

          // If STUDENT, strictly enforce IDOR check: only allow viewing their own session snapshots
          if (!allowed && decoded.role === 'STUDENT' && decoded.sub) {
            const match = req.path.match(/^\/(?:snapshot|sim-[a-z_]+)-(\d+)-/);
            if (match) {
              const snapshotSessionId = Number(match[1]);
              const rows = await queryRows<RowDataPacket[]>(
                'SELECT student_id FROM Exam_Sessions WHERE id = ? LIMIT 1',
                [snapshotSessionId]
              );
              if (rows[0] && Number(rows[0].student_id) === Number(decoded.sub)) {
                allowed = true;
              }
            }
          }

          if (!allowed) {
            res.status(403).json({
              success: false,
              data: null,
              error: {
                code: 'FORBIDDEN',
                message: 'Forensic snapshots are restricted to authorized proctors and the verified session examinee.',
              },
            });
            return;
          }
        } catch {
          res.status(401).json({
            success: false,
            data: null,
            error: {
              code: 'INVALID_SNAPSHOT_TOKEN',
              message: 'Invalid or expired snapshot authorization token.',
            },
          });
          return;
        }
      }

      // Stream object from StorageAdapter
      const relativePath = req.path.replace(/^\/+/, '');
      const storageKey = resolveStorageKey(relativePath);
      const adapter = getStorageAdapter();

      try {
        const streamResult = await adapter.get(storageKey);
        res.setHeader('Content-Type', streamResult.contentType || 'image/jpeg');
        res.setHeader('Content-Length', streamResult.size);
        res.setHeader('Cache-Control', 'private, max-age=300');
        streamResult.stream.pipe(res);
      } catch {
        // Fallback: try raw relative key
        try {
          const rawResult = await adapter.get(relativePath);
          res.setHeader('Content-Type', rawResult.contentType || 'image/jpeg');
          res.setHeader('Content-Length', rawResult.size);
          res.setHeader('Cache-Control', 'private, max-age=300');
          rawResult.stream.pipe(res);
        } catch {
          res.status(404).json({
            success: false,
            data: null,
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'Forensic snapshot file not found in storage.',
            },
          });
        }
      }
    }
  );

  app.get('/api/health', async (_req, res) => {
    const dbHealth = await getDbHealth();
    sendSuccess(res, {
      service: 'proctoriq-api',
      api: 'up',
      db: dbHealth.connected ? 'up' : 'down',
      status: dbHealth.connected ? 'ok' : 'degraded',
      mysqlVersion: dbHealth.version ?? '8.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Auto-generated OpenAPI JSON & Swagger UI at /api/docs
  app.get('/api/docs.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/auth', authRouter);
  app.use('/api/exams', examsRouter);
  app.use('/api/violation-types', violationTypesRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/extensions', extensionsRouter);
  app.use('/api/monitor', monitorRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/violations', violationsRouter);
  app.use('/api/proctor', proctorRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api', recordingsRouter);
  app.use('/api/snapshots', snapshotsRouter);
  app.use('/api/realtime', realtimeRouter);
  app.get('/api/events', requireAuth, validate({ query: getEventsQuerySchema }), handleGetEvents);

  // Dedicated simulator reset endpoint
  app.post(
    '/api/simulator/reset',
    requireAuth,
    requireRole('ADMIN'),
    async (_req, res, next) => {
      try {
        const counts = await simulatorEngine.reset();
        sendSuccess(res, counts);
      } catch (err) {
        next(err);
      }
    }
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
