import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { testDbConnection } from './config/db.js';
import { env } from './config/env.js';
import { openApiSpec } from './docs/openapi.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { adminRouter } from './routes/admin.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { examsRouter } from './routes/exams.routes.js';
import { logsRouter } from './routes/logs.routes.js';
import { monitorRouter } from './routes/monitor.routes.js';
import { proctorRouter } from './routes/proctor.routes.js';
import { sessionsRouter } from './routes/sessions.routes.js';
import { violationsRouter } from './routes/violations.routes.js';
import { violationTypesRouter } from './routes/violationTypes.routes.js';
import { sendSuccess } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const serverUploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(serverUploadsDir)) {
  fs.mkdirSync(serverUploadsDir, { recursive: true });
}

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

  // Protected static snapshots route: requires valid JWT in Bearer header or ?token= query parameter
  app.use(
    '/uploads',
    (req, res, next) => {
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
        jwt.verify(token, env.JWT_SECRET);
        next();
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
    },
    express.static(serverUploadsDir)
  );

  app.get('/api/health', async (_req, res) => {
    const dbConnected = await testDbConnection();
    sendSuccess(res, {
      service: 'proctoriq-api',
      status: dbConnected ? 'ok' : 'degraded',
      db: dbConnected ? 'connected' : 'disconnected',
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
  app.use('/api/monitor', monitorRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/violations', violationsRouter);
  app.use('/api/proctor', proctorRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
