import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { getStorageAdapter } from '../storage/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Splits a MySQL script containing DELIMITER directives (triggers, stored procedures, views)
 * into individual executable SQL statements.
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

/**
 * Creates a raw MySQL connection for migrations.
 */
async function createMigrationConnection(): Promise<Connection> {
  const ssl = env.DB_SSL
    ? {
        rejectUnauthorized: true,
        ...(env.DB_SSL_CA ? { ca: readFileSync(env.DB_SSL_CA, 'utf8') } : {}),
      }
    : undefined;

  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: false,
    timezone: 'Z',
    dateStrings: false,
    ssl,
  });
}

/**
 * Ensures the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(conn: Connection): Promise<void> {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

/**
 * Returns set of already applied migration versions.
 */
async function getAppliedMigrations(conn: Connection): Promise<Set<string>> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return new Set(rows.map((r) => String(r.version)));
}

/**
 * Backfills schema_migrations if tables already exist but schema_migrations is empty.
 * This ensures existing environments transition smoothly without "Table already exists" errors.
 */
async function backfillExistingMigrationsIfNeeded(
  conn: Connection,
  migrationFiles: string[]
): Promise<void> {
  const applied = await getAppliedMigrations(conn);

  const [usersTable] = await conn.query<RowDataPacket[]>(
    "SHOW TABLES LIKE 'Users'"
  );
  if (usersTable.length === 0) return;

  // Helper to test if a column exists
  async function hasColumn(table: string, column: string): Promise<boolean> {
    try {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
        [column]
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  // Helper to test if a table/view exists
  async function hasTableOrView(name: string): Promise<boolean> {
    try {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SHOW TABLES LIKE ?`,
        [name]
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;
    let isApplied = false;

    if (file === '001_init.sql') isApplied = await hasTableOrView('Users');
    else if (file === '002_improvements.sql') isApplied = await hasTableOrView('vw_ViolationHeatmap');
    else if (file === '003_session_security.sql') isApplied = await hasColumn('Exam_Sessions', 'ip_address');
    else if (file === '004_snapshot_support.sql') isApplied = await hasColumn('Proctoring_Logs', 'snapshot_url');
    else if (file === '005_performance_indexes.sql') isApplied = await hasTableOrView('Results');
    else if (file === '006_simulator_reset.sql') {
      try {
        const [routines] = await conn.query<RowDataPacket[]>(
          "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_NAME = 'sp_ResetSimulatorData'",
          [env.DB_NAME]
        );
        isApplied = routines.length > 0;
      } catch {
        isApplied = false;
      }
    }
    else if (file === '007_time_extension_requests.sql') isApplied = await hasTableOrView('Time_Extension_Requests');
    else if (file === '008_extension_grace_window.sql') isApplied = await hasColumn('Exams', 'max_extension_mins');
    else if (file === '009_warning_gate_and_new_violation_types.sql') isApplied = await hasTableOrView('Session_Warnings');
    else if (file === '010_warning_fields_in_views.sql') isApplied = await hasColumn('Session_Warnings', 'warning_id');
    else if (file === '011_unique_paper_versions.sql') isApplied = await hasColumn('Exam_Sessions', 'paper_code');
    else if (file === '012_notifications.sql') isApplied = await hasTableOrView('Notifications');
    else if (file === '013_live_sessions_view.sql') isApplied = await hasTableOrView('vw_LiveSessions');
    else if (file === '014_perf_indexes_and_settings.sql') isApplied = await hasTableOrView('System_Settings');
    else if (file === '015_exam_recordings.sql') isApplied = await hasTableOrView('Exam_Recordings');
    else if (file === '016_recording_notes.sql') isApplied = await hasTableOrView('Recording_Notes');
    else if (file === '017_realtime_events.sql') isApplied = await hasTableOrView('Events');

    if (isApplied) {
      await conn.query(
        'INSERT IGNORE INTO schema_migrations (version) VALUES (?)',
        [file]
      );
      console.log(`[db:migrate] Recorded existing migration: ${file}`);
    }
  }
}

/**
 * Runs pending migrations in order.
 */
export async function runMigrations(): Promise<number> {
  const projectRootDir = path.resolve(__dirname, '../../../');
  const dbDir = path.resolve(__dirname, '../../../db');
  const migrationsDir = env.DB_MIGRATIONS_DIR
    ? path.resolve(projectRootDir, env.DB_MIGRATIONS_DIR)
    : path.join(dbDir, 'migrations');

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`[db:migrate] Connecting to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`);
  const conn = await createMigrationConnection();

  try {
    await ensureMigrationsTable(conn);
    await backfillExistingMigrationsIfNeeded(conn, migrationFiles);

    const applied = await getAppliedMigrations(conn);
    let appliedCount = 0;

    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await conn.query("SET time_zone = '+00:00';");

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }

      console.log(`[db:migrate] Applying migration ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlText = readFileSync(filePath, 'utf8');
      const statements = parseSqlScript(sqlText);

      for (const stmt of statements) {
        // Rewrite or skip hardcoded USE statements so migrations respect env.DB_NAME
        if (/^USE\s+[`"']?[a-zA-Z0-9_]+[`"']?\s*;?$/i.test(stmt.trim())) {
          await conn.query(`USE \`${env.DB_NAME}\`;`);
          continue;
        }
        await conn.query(stmt);
      }

      await conn.query(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        [file]
      );
      appliedCount++;
      console.log(`[db:migrate] Migration ${file} applied successfully.`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

    if (appliedCount === 0) {
      console.log('[db:migrate] All migrations are up to date.');
    } else {
      console.log(`[db:migrate] Applied ${appliedCount} migration(s) successfully.`);
    }

    return appliedCount;
  } finally {
    await conn.end();
  }
}

/**
 * Applies seed data to the database.
 */
export async function runSeed(): Promise<void> {
  const projectRootDir = path.resolve(__dirname, '../../../');
  const dbDir = path.resolve(__dirname, '../../../db');
  const seedPath = env.DB_SEED_PATH
    ? path.resolve(projectRootDir, env.DB_SEED_PATH)
    : path.join(dbDir, 'seed.sql');

  console.log(`[db:seed] Connecting to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`);
  const conn = await createMigrationConnection();

  try {
    console.log(`[db:seed] Reading seed file: ${seedPath}`);
    const seedSql = readFileSync(seedPath, 'utf8');
    const statements = parseSqlScript(seedSql);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await conn.query("SET time_zone = '+00:00';");

    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (err) {
        // If duplicate entry on unique/primary key in seed, log and continue
        const errCode = (err as { code?: string })?.code;
        if (errCode === 'ER_DUP_ENTRY') {
          continue;
        }
        throw err;
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('[db:seed] Seed completed successfully.');
  } finally {
    await conn.end();
  }
}

/**
 * Resets the database.
 * STRICT SAFETY GUARD: Refuses execution unless DB_NAME ends with '_dev' or '_test'.
 */
export async function runReset(): Promise<void> {
  const dbName = env.DB_NAME;
  if (!dbName.endsWith('_dev') && !dbName.endsWith('_test')) {
    throw new Error(
      `[SAFETY GUARD VIOLATION] db:reset is strictly prohibited on database '${dbName}'. Reset is only permitted on databases whose name ends with '_dev' or '_test'. Real production database '${dbName}' is protected.`
    );
  }

  console.log(`[db:reset] Resetting database '${dbName}'...`);
  const conn = await createMigrationConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Drop all views
    const [views] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`,
      [dbName]
    );
    for (const v of views) {
      console.log(`[db:reset] Dropping view ${v.TABLE_NAME}...`);
      await conn.query(`DROP VIEW IF EXISTS \`${v.TABLE_NAME}\``);
    }

    // Drop all triggers
    const [triggers] = await conn.query<RowDataPacket[]>(
      `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`,
      [dbName]
    );
    for (const t of triggers) {
      console.log(`[db:reset] Dropping trigger ${t.TRIGGER_NAME}...`);
      await conn.query(`DROP TRIGGER IF EXISTS \`${t.TRIGGER_NAME}\``);
    }

    // Drop all routines (procedures and functions)
    const [routines] = await conn.query<RowDataPacket[]>(
      `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?`,
      [dbName]
    );
    for (const r of routines) {
      console.log(`[db:reset] Dropping ${r.ROUTINE_TYPE} ${r.ROUTINE_NAME}...`);
      await conn.query(`DROP ${r.ROUTINE_TYPE} IF EXISTS \`${r.ROUTINE_NAME}\``);
    }

    // Drop all base tables
    const [tables] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [dbName]
    );
    for (const tbl of tables) {
      console.log(`[db:reset] Dropping table ${tbl.TABLE_NAME}...`);
      await conn.query(`DROP TABLE IF EXISTS \`${tbl.TABLE_NAME}\``);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log(`[db:reset] All objects dropped in '${dbName}'. Re-running migrations and seeds...`);
  } finally {
    await conn.end();
  }

  // Clean up object storage evidence for dev/test environment during reset
  try {
    const adapter = getStorageAdapter();
    const prefix = env.STORAGE_PREFIX || (dbName.endsWith('_test') ? 'test/' : '');
    if (prefix) {
      console.log(`[db:reset] Cleaning storage prefix '${prefix}'...`);
      await adapter.deletePrefix(prefix);
    } else if (dbName.endsWith('_dev')) {
      console.log(`[db:reset] Cleaning dev storage objects...`);
      await adapter.deletePrefix('snapshots/');
      await adapter.deletePrefix('recordings/');
    }
  } catch (storageErr) {
    console.warn('[db:reset] Storage cleanup warning:', storageErr);
  }

  await runMigrations();
  await runSeed();
  console.log(`[db:reset] Database '${dbName}' has been reset, migrated, and seeded successfully.`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'migrate';

  if (command === 'migrate') {
    await runMigrations();
  } else if (command === 'seed') {
    await runSeed();
  } else if (command === 'reset') {
    await runReset();
  } else {
    console.error(`Unknown command: ${command}. Use 'migrate', 'seed', or 'reset'.`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error('[db:migrate error]:', err);
    process.exit(1);
  });
}
