import { createServer } from 'node:http';
import { createApp } from './app.js';
import { getDbHealth, pool } from './config/db.js';
import { env } from './config/env.js';

export const app = createApp();
export const httpServer = createServer(app);

export async function bootstrap(): Promise<void> {
  const health = await getDbHealth();
  if (!health.connected) {
    console.error(
      `\x1b[31m[ProctorIQ Database Error]\x1b[0m MySQL is not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start your MySQL service or check .env`
    );
  } else {
    console.log(
      `\x1b[32m[ProctorIQ Database Ready]\x1b[0m Connected to MySQL at ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME} (MySQL v${health.version}, Triggers: ${health.triggersCount}, Procedures: ${health.proceduresCount})`
    );
  }

  httpServer.listen(env.PORT, () => {
    console.log(`[ProctorIQ] API server listening on http://localhost:${env.PORT}`);
    console.log(`[ProctorIQ] Swagger docs available at http://localhost:${env.PORT}/api/docs`);
  });
}

function shutdown(signal: string): void {
  console.log(`[ProctorIQ] Received ${signal}. Closing server gracefully...`);
  httpServer.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap().catch((err) => {
  console.error('[ProctorIQ] Fatal startup error:', err);
  process.exit(1);
});
