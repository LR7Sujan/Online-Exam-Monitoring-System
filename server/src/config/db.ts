import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { env } from './env.js';

export const pool: Pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: 0,
  namedPlaceholders: false,
  multipleStatements: false,
  timezone: 'Z',
});

export type SqlParams = Parameters<Pool['execute']>[1];

export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: SqlParams = []
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

export async function executeSql(
  sql: string,
  params: SqlParams = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withConnection<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

export interface DbHealthResult {
  connected: boolean;
  version?: string;
}

export async function testDbConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function getDbHealth(): Promise<DbHealthResult> {
  try {
    const rows = await queryRows<RowDataPacket[]>('SELECT VERSION() as version');
    const versionRow = rows[0] as { version?: string } | undefined;
    const version = versionRow?.version ? String(versionRow.version).split('-')[0] : '8.0';
    return { connected: true, version };
  } catch {
    return { connected: false };
  }
}
