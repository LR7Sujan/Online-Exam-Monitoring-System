import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { parseSqlScript } from './initDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure test environment
process.env.NODE_ENV = 'test';
const testEnvCandidate = [
  path.resolve(__dirname, '../../../.env.test'),
  path.resolve(__dirname, '../../.env.test'),
].find((p) => existsSync(p));

if (testEnvCandidate) {
  process.loadEnvFile(testEnvCandidate);
}

if (!process.env.DB_NAME || process.env.DB_NAME === 'proctoriq') {
  process.env.DB_NAME = 'exam_monitoring_test';
}

export const TEST_DB_NAME = process.env.DB_NAME || 'exam_monitoring_test';

/**
 * Asserts strict safety guard before executing any test database operation.
 * Refuses execution if NODE_ENV !== 'test' or database name does not end with '_test'.
 */
export function assertTestDatabaseSafety(dbName: string = TEST_DB_NAME): void {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'test') {
    throw new Error(
      `[SAFETY GUARD VIOLATION] Refusing to perform test database operation with NODE_ENV='${nodeEnv}'. Must be 'test'.`
    );
  }

  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `[SAFETY GUARD VIOLATION] Refusing to perform test database operation on database '${dbName}'. Target DB name must end with '_test'. Real database '${dbName}' will NEVER be touched by automated tests.`
    );
  }
}

/**
 * Transforms SQL migration and seed scripts so they target the specified test database
 * instead of hardcoded 'proctoriq'.
 */
export function transformSqlForTestDb(sqlText: string, targetDb: string): string {
  // Replace database creation & USE directives
  let transformed = sqlText.replace(/CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+[`]?proctoriq[`]?/gi, `CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
  transformed = transformed.replace(/USE\s+[`]?proctoriq[`]?\s*;/gi, `USE \`${targetDb}\`;`);
  transformed = transformed.replace(/USE\s+[`]?exam_monitoring_test[`]?\s*;/gi, `USE \`${targetDb}\`;`);
  return transformed;
}

export async function initTestDatabase(options: { reset?: boolean; seed?: boolean } = {}): Promise<void> {
  const { reset = false, seed = true } = options;

  // Enforce safety guard before any connection
  assertTestDatabaseSafety(TEST_DB_NAME);

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'proctoriq_root';

  const projectRootDir = path.resolve(__dirname, '../../../');
  const dbDir = path.resolve(projectRootDir, 'db');
  const migrationsDir = path.join(dbDir, 'migrations');
  const seedPath = path.join(dbDir, 'seed.sql');

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: false,
  });

  try {
    if (reset) {
      console.log(`[db:test:reset] Dropping test database \`${TEST_DB_NAME}\`...`);
      await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`;`);
    }

    console.log(`[db:test] Creating test database \`${TEST_DB_NAME}\`...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${TEST_DB_NAME}\`;`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      console.log(`[db:test] Applying migration db/migrations/${file} to \`${TEST_DB_NAME}\`...`);
      const rawSql = readFileSync(filePath, 'utf8');
      const transformed = transformSqlForTestDb(rawSql, TEST_DB_NAME);
      for (const stmt of parseSqlScript(transformed)) {
        await conn.query(stmt);
      }
    }

    if (seed) {
      console.log(`[db:test] Applying seed ${path.basename(seedPath)} to \`${TEST_DB_NAME}\`...`);
      const rawSeed = readFileSync(seedPath, 'utf8');
      const transformedSeed = transformSqlForTestDb(rawSeed, TEST_DB_NAME);
      for (const stmt of parseSqlScript(transformedSeed)) {
        await conn.query(stmt);
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log(`[db:test] Database \`${TEST_DB_NAME}\` ready.`);
  } finally {
    await conn.end();
  }
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const isReset = process.argv.includes('--reset');
  process.env.NODE_ENV = 'test';
  initTestDatabase({ reset: isReset, seed: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:test] Error:', err);
      process.exit(1);
    });
}
