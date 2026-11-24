import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations, runSeed } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);

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
  console.log('[db:init] Running migrations and seeds via migration runner...');
  await runMigrations();
  await runSeed();
  console.log('[db:init] Database migrated and seeded successfully.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((err) => {
    console.error('[db:init] Failed:', err);
    process.exit(1);
  });
}
