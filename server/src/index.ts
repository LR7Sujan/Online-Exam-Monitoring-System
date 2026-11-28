import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from './app.js';
import { waitForDatabase, pool } from './config/db.js';
import { env, validateMailConfig } from './config/env.js';

export const app = createApp();
export const httpServer = createServer(app);

let isBootstrapped = false;

export async function bootstrap(): Promise<void> {
  if (isBootstrapped || httpServer.listening) {
    return;
  }
  isBootstrapped = true;

  // Validate mail environment settings on startup
  validateMailConfig(env);

  // Wait for database with exponential backoff up to 60s
  const health = await waitForDatabase({ maxWaitMs: 60000, initialDelayMs: 500 });
  if (!health.connected) {
    console.error(
      `\x1b[31m[ProctorIQ Database Offline]\x1b[0m MySQL not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start the MySQL service (services.msc > MySQL80) or check .env`
    );
  } else {
    console.log(
      `\x1b[32m[ProctorIQ Database Ready]\x1b[0m Connected to MySQL at ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME} (MySQL v${health.version}, Triggers: ${health.triggersCount}, Procedures: ${health.proceduresCount})`
    );
  }

  return new Promise<void>((resolve, reject) => {
    httpServer.listen(env.PORT, () => {
      console.log(`[ProctorIQ] API server listening on http://localhost:${env.PORT}`);
      console.log(`[ProctorIQ] Swagger docs available at http://localhost:${env.PORT}/api/docs`);
      resolve();
    });
    httpServer.once('error', (err) => {
      isBootstrapped = false;
      reject(err);
    });
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

// Only auto-start if invoked directly as the process entrypoint (not when imported)
const isEntryFile =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isEntryFile) {
  bootstrap().catch((err) => {
    console.error('[ProctorIQ] Fatal startup error:', err);
    process.exit(1);
  });
}
