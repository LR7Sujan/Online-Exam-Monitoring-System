import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
  type SslOptions,
} from 'mysql2/promise';
import { existsSync, readFileSync } from 'node:fs';
import { env } from './env.js';

declare global {
  var __proctoriq_pool: Pool | undefined;
}

function resolveSslConfig(): SslOptions | undefined {
  if (!env.DB_SSL) {
    return undefined;
  }

  const ssl: SslOptions = {
    rejectUnauthorized: true,
  };

  const caPathOrCert = env.DB_SSL_CA || env.DB_CA_CERT;
  if (caPathOrCert) {
    try {
      if (existsSync(caPathOrCert)) {
        ssl.ca = readFileSync(caPathOrCert, 'utf8');
      } else {
        ssl.ca = caPathOrCert;
      }
    } catch (err) {
      console.warn('[DB] Failed to read CA certificate from path, using raw string:', err);
      ssl.ca = caPathOrCert;
    }
  }

  return ssl;
}

/**
 * Creates a new MySQL connection pool configured for serverless-safe execution:
 * - Low connection limit (1-3) to avoid connection exhaustion under lambda scale-out
 * - Keepalive and connection timeouts
 * - Explicit UTC timezone setting ('Z')
 * - Automatic disposal on connection loss
 */
export function createNewPool(): Pool {
  const ssl = resolveSslConfig();

  const newPool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    namedPlaceholders: false,
    multipleStatements: false,
    timezone: 'Z',
    dateStrings: false,
    ssl,
  });

  // Handle fatal pool/socket error events
  (newPool as unknown as { on: (event: string, cb: (...args: unknown[]) => void) => void }).on(
    'error',
    (err: unknown) => {
      console.error('[DB Pool Event Error]:', err);
      const errCode = (err as { code?: string })?.code;
      if (
        errCode === 'PROTOCOL_CONNECTION_LOST' ||
        errCode === 'ECONNRESET' ||
        errCode === 'ETIMEDOUT' ||
        errCode === 'EPIPE'
      ) {
        console.warn('[DB] Connection lost. Invalidate global pool cache for recreation...');
        if (globalThis.__proctoriq_pool === newPool) {
          globalThis.__proctoriq_pool = undefined;
        }
      }
    }
  );

  return newPool;
}

/**
 * Returns the cached MySQL connection pool from globalThis, lazily creating it if needed.
 */
export function getPool(): Pool {
  if (!globalThis.__proctoriq_pool) {
    globalThis.__proctoriq_pool = createNewPool();
  }
  return globalThis.__proctoriq_pool;
}

/**
 * Closes the cached connection pool and resets the global reference.
 */
export async function resetPool(): Promise<void> {
  if (globalThis.__proctoriq_pool) {
    try {
      await globalThis.__proctoriq_pool.end();
    } catch {
      // Ignore teardown errors
    }
    globalThis.__proctoriq_pool = undefined;
  }
}

/**
 * Transparent Proxy export for `pool`.
 * Any call like `pool.execute(...)`, `pool.query(...)`, `pool.getConnection()`, `pool.end()`
 * lazily accesses the active cached pool on globalThis.
 */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop: string | symbol) {
    if (prop === 'end') {
      return async () => {
        await resetPool();
      };
    }
    const currentPool = getPool();
    const val = (currentPool as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(currentPool) : val;
  },
});

export type SqlParams = Parameters<Pool['execute']>[1];

export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: SqlParams = []
): Promise<T> {
  try {
    const [rows] = await getPool().execute<T>(sql, params);
    return rows;
  } catch (err) {
    const errCode = (err as { code?: string })?.code;
    const errMsg = (err as Error)?.message || '';
    if (
      errCode === 'PROTOCOL_CONNECTION_LOST' ||
      errCode === 'ECONNRESET' ||
      errCode === 'ETIMEDOUT' ||
      errMsg.includes('closed state')
    ) {
      console.warn('[DB] queryRows failed due to connection loss. Retrying with fresh pool...');
      await resetPool();
      const [rows] = await getPool().execute<T>(sql, params);
      return rows;
    }
    throw err;
  }
}

export async function executeSql(
  sql: string,
  params: SqlParams = []
): Promise<ResultSetHeader> {
  try {
    const [result] = await getPool().execute<ResultSetHeader>(sql, params);
    return result;
  } catch (err) {
    const errCode = (err as { code?: string })?.code;
    const errMsg = (err as Error)?.message || '';
    if (
      errCode === 'PROTOCOL_CONNECTION_LOST' ||
      errCode === 'ECONNRESET' ||
      errCode === 'ETIMEDOUT' ||
      errMsg.includes('closed state')
    ) {
      console.warn('[DB] executeSql failed due to connection loss. Retrying with fresh pool...');
      await resetPool();
      const [result] = await getPool().execute<ResultSetHeader>(sql, params);
      return result;
    }
    throw err;
  }
}

export async function withConnection<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const currentPool = getPool();
  const conn = await currentPool.getConnection();
  try {
    // Explicitly guarantee UTC timezone on connection session
    await conn.query("SET time_zone = '+00:00'");
    return await fn(conn);
  } catch (err) {
    const errCode = (err as { code?: string })?.code;
    if (
      errCode === 'PROTOCOL_CONNECTION_LOST' ||
      errCode === 'ECONNRESET' ||
      errCode === 'ETIMEDOUT'
    ) {
      console.warn('[DB] Connection error encountered. Invalidating pool cache...');
      if (globalThis.__proctoriq_pool === currentPool) {
        globalThis.__proctoriq_pool = undefined;
      }
    }
    throw err;
  } finally {
    conn.release();
  }
}

export interface DbHealthResult {
  connected: boolean;
  version?: string;
  triggersCount?: number;
  proceduresCount?: number;
  pingMs?: number;
  error?: string;
}

export async function testDbConnection(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

let cachedDbMeta: { version: string; triggersCount: number; proceduresCount: number } | null = null;

export async function getDbHealth(quick: boolean = true): Promise<DbHealthResult> {
  try {
    const currentPool = getPool();
    const t0 = performance.now();
    await currentPool.query('SELECT 1');
    const pingMs = Math.round(performance.now() - t0);

    if (quick && cachedDbMeta) {
      return {
        connected: true,
        version: cachedDbMeta.version,
        triggersCount: cachedDbMeta.triggersCount,
        proceduresCount: cachedDbMeta.proceduresCount,
        pingMs,
      };
    }

    const [versionRows] = await currentPool.query<RowDataPacket[]>('SELECT VERSION() as version');
    const versionRow = versionRows[0] as { version?: string } | undefined;
    const version = versionRow?.version ? String(versionRow.version).split('-')[0] : '8.0';

    const [triggerRows] = await currentPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`,
      [env.DB_NAME]
    );
    const triggersCount = Number(triggerRows[0]?.cnt ?? 0);

    const [procRows] = await currentPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`,
      [env.DB_NAME]
    );
    const proceduresCount = Number(procRows[0]?.cnt ?? 0);

    cachedDbMeta = { version, triggersCount, proceduresCount };

    return {
      connected: true,
      version,
      triggersCount,
      proceduresCount,
      pingMs,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Database connection failed';
    return {
      connected: false,
      error: errorMsg,
    };
  }
}

/**
 * Waits for MySQL database with exponential backoff up to maxWaitMs (default 60s).
 * Does not crash if unavailable; prints helpful diagnostic guidance and allows
 * HTTP server to boot and report health accurately.
 */
export async function waitForDatabase(options: {
  maxWaitMs?: number;
  initialDelayMs?: number;
  silent?: boolean;
} = {}): Promise<DbHealthResult> {
  const maxWaitMs = options.maxWaitMs ?? 60000;
  let delay = options.initialDelayMs ?? 500;
  const startTime = Date.now();
  let firstFailureLogged = false;

  while (Date.now() - startTime < maxWaitMs) {
    const health = await getDbHealth();
    if (health.connected) {
      return health;
    }

    if (!firstFailureLogged && !options.silent) {
      console.warn(
        `\x1b[33m[ProctorIQ]\x1b[0m MySQL not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start the MySQL service (services.msc > MySQL80) or check .env`
      );
      firstFailureLogged = true;
    }

    const remainingTime = maxWaitMs - (Date.now() - startTime);
    if (remainingTime <= 0) break;
    const sleepTime = Math.min(delay, remainingTime);
    await new Promise((resolve) => setTimeout(resolve, sleepTime));
    delay = Math.min(delay * 1.5, 5000);
  }

  return getDbHealth();
}
