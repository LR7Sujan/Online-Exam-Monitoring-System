import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Splits a MySQL script containing DELIMITER directives (such as triggers and
 * stored procedures) into individual executable SQL statements.
 */
export function parseSqlScript(sqlText: string): string[] {
  const lines = sqlText.replace(/\r\n/g, '\n').split('\n');
  let delimiter = ';';
  let buffer = '';
  const statements: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('--') || trimmed === '') {
      continue;
    }

    const delimiterMatch = /^DELIMITER\s+(\S+)$/i.exec(trimmed);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += (buffer ? '\n' : '') + rawLine;
    if (buffer.trimEnd().endsWith(delimiter)) {
      const idx = buffer.lastIndexOf(delimiter);
      const stmt = buffer.slice(0, idx).trim();
      if (stmt) {
        statements.push(stmt);
      }
      buffer = '';
    }
  }

  if (buffer.trim()) {
    statements.push(buffer.trim());
  }

  return statements;
}

async function run(): Promise<void> {
  // Resolve db folder relative to script location so it runs from any CWD
  const projectRootDir = path.resolve(__dirname, '../../../');
  const dbDir = path.resolve(__dirname, '../../../db');
  const migrationsDir = env.DB_MIGRATIONS_DIR
    ? path.resolve(projectRootDir, env.DB_MIGRATIONS_DIR)
    : path.join(dbDir, 'migrations');
  const seedPath = env.DB_SEED_PATH
    ? path.resolve(projectRootDir, env.DB_SEED_PATH)
    : path.join(dbDir, 'seed.sql');

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: false,
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      console.log(`[db:init] Applying migration db/migrations/${file}...`);
      const sqlText = readFileSync(filePath, 'utf8');
      for (const stmt of parseSqlScript(sqlText)) {
        await conn.query(stmt);
      }
    }

    console.log('[db:init] Applying db/seed.sql...');
    const seedSql = readFileSync(seedPath, 'utf8');
    for (const stmt of parseSqlScript(seedSql)) {
      await conn.query(stmt);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('[db:init] Database created, migrated, and seeded successfully.');
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((err) => {
    console.error('[db:init] Failed:', err);
    process.exit(1);
  });
}
