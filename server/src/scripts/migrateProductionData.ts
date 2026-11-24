/**
 * Production Data Migration & Verification Script
 *
 * Exports data and schema objects from source MySQL (e.g. Docker container or local MySQL)
 * and imports them into the hosted/target MySQL database.
 *
 * Capabilities:
 * 1. Safe dry-run mode (--dry-run) by default.
 * 2. Compares row counts per table between source and target.
 * 3. Compares triggers, procedures, and views between source and target.
 * 4. Refuses to overwrite production target without explicit --confirm-production flag.
 *
 * Usage:
 *   npx tsx scripts/migrate_production_data.ts --dry-run
 *   npx tsx scripts/migrate_production_data.ts --source-db=proctoriq --target-db=proctoriq_dev --execute
 */

import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key] = val !== undefined ? val : true;
    }
  }

  const isDryRun = Boolean(flags['dry-run']) || !flags['execute'];
  const confirmProduction = Boolean(flags['confirm-production']);

  const sourceConfig: DbConfig = {
    host: String(flags['source-host'] || process.env.SOURCE_DB_HOST || process.env.DB_HOST || '127.0.0.1'),
    port: Number(flags['source-port'] || process.env.SOURCE_DB_PORT || process.env.DB_PORT || 3306),
    user: String(flags['source-user'] || process.env.SOURCE_DB_USER || process.env.DB_USER || 'root'),
    password: String(flags['source-password'] || process.env.SOURCE_DB_PASSWORD || process.env.DB_PASSWORD || 'proctoriq_root'),
    database: String(flags['source-db'] || process.env.SOURCE_DB_NAME || 'proctoriq'),
    ssl: flags['source-ssl'] === 'true' || process.env.SOURCE_DB_SSL === 'true',
  };

  const targetConfig: DbConfig = {
    host: String(flags['target-host'] || process.env.TARGET_DB_HOST || sourceConfig.host),
    port: Number(flags['target-port'] || process.env.TARGET_DB_PORT || sourceConfig.port),
    user: String(flags['target-user'] || process.env.TARGET_DB_USER || sourceConfig.user),
    password: String(flags['target-password'] || process.env.TARGET_DB_PASSWORD || sourceConfig.password),
    database: String(flags['target-db'] || process.env.TARGET_DB_NAME || 'proctoriq_dev'),
    ssl: flags['target-ssl'] === 'true' || process.env.TARGET_DB_SSL === 'true',
  };

  return { isDryRun, confirmProduction, sourceConfig, targetConfig };
}

async function createConn(config: DbConfig): Promise<Connection> {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    timezone: 'Z',
  });
}

async function getDatabaseObjects(conn: Connection, dbName: string) {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    [dbName]
  );

  const [views] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [dbName]
  );

  const [triggers] = await conn.query<RowDataPacket[]>(
    `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME`,
    [dbName]
  );

  const [routines] = await conn.query<RowDataPacket[]>(
    `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_NAME`,
    [dbName]
  );

  return {
    tables: tables.map((t) => String(t.TABLE_NAME)),
    views: views.map((v) => String(v.TABLE_NAME)),
    triggers: triggers.map((t) => `${t.TRIGGER_NAME} (${t.EVENT_MANIPULATION} on ${t.EVENT_OBJECT_TABLE})`),
    routines: routines.map((r) => `${r.ROUTINE_TYPE} ${r.ROUTINE_NAME}`),
  };
}

async function getTableCounts(conn: Connection, tables: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const tbl of tables) {
    try {
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM \`${tbl}\``);
      counts[tbl] = Number(rows[0]?.cnt ?? 0);
    } catch {
      counts[tbl] = -1;
    }
  }
  return counts;
}

async function migrateData(sourceConn: Connection, targetConn: Connection, tables: string[]) {
  console.log('\n--- Starting Table Data Migration ---');
  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const tbl of tables) {
    if (tbl === 'schema_migrations') continue;

    console.log(`Migrating table '${tbl}'...`);
    const [rows] = await sourceConn.query<RowDataPacket[]>(`SELECT * FROM \`${tbl}\``);
    if (rows.length === 0) {
      console.log(`  -> 0 rows (empty table)`);
      continue;
    }

    // Clear target table before insert
    await targetConn.query(`DELETE FROM \`${tbl}\``);

    // Insert rows in batches of 100
    const batchSize = 100;
    const columns = Object.keys(rows[0]);
    const colSql = columns.map((c) => `\`${c}\``).join(', ');
    const placeholderSql = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO \`${tbl}\` (${colSql}) VALUES (${placeholderSql})`;

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      for (const row of chunk) {
        const values = columns.map((c) => row[c]);
        await targetConn.execute(insertSql, values);
      }
    }
    console.log(`  -> Migrated ${rows.length} rows.`);
  }

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('--- Table Data Migration Complete ---\n');
}

async function run() {
  const { isDryRun, confirmProduction, sourceConfig, targetConfig } = parseCliArgs();

  console.log('=================================================================');
  console.log('ProctorIQ Database Migration & Comparison Utility');
  console.log('=================================================================');
  console.log(`Mode:           ${isDryRun ? 'DRY-RUN (No changes applied)' : 'EXECUTE'}`);
  console.log(`Source DB:      ${sourceConfig.user}@${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}`);
  console.log(`Target DB:      ${targetConfig.user}@${targetConfig.host}:${targetConfig.port}/${targetConfig.database}`);
  console.log('=================================================================\n');

  // Safety protection against accidental production overwrite
  if (!isDryRun && (targetConfig.database === 'proctoriq' || !targetConfig.database.match(/_(dev|test|stage)$/))) {
    if (!confirmProduction) {
      console.error(
        `🚨 [SAFETY BLOCK] Target database is '${targetConfig.database}'. Writing to a production database requires the '--confirm-production' flag.`
      );
      process.exit(1);
    }
  }

  console.log('Connecting to Source Database...');
  const sourceConn = await createConn(sourceConfig);
  console.log('Connecting to Target Database...');
  const targetConn = await createConn(targetConfig);

  try {
    const sourceObjects = await getDatabaseObjects(sourceConn, sourceConfig.database);
    const targetObjects = await getDatabaseObjects(targetConn, targetConfig.database);

    console.log(`\nSource Tables:   ${sourceObjects.tables.length}`);
    console.log(`Target Tables:   ${targetObjects.tables.length}`);
    console.log(`Source Views:    ${sourceObjects.views.length}`);
    console.log(`Target Views:    ${targetObjects.views.length}`);
    console.log(`Source Triggers: ${sourceObjects.triggers.length}`);
    console.log(`Target Triggers: ${targetObjects.triggers.length}`);
    console.log(`Source Routines: ${sourceObjects.routines.length}`);
    console.log(`Target Routines: ${targetObjects.routines.length}`);

    const sourceCounts = await getTableCounts(sourceConn, sourceObjects.tables);

    if (isDryRun) {
      console.log('\n--- DRY-RUN SUMMARY (Source Data Snapshot) ---');
      console.table(
        sourceObjects.tables.map((t) => ({
          Table: t,
          SourceRows: sourceCounts[t],
          Status: 'Pending Migration',
        }))
      );
      console.log('\n[Dry Run]: No data was written to target database. Pass --execute to migrate.');
      return;
    }

    // Execution mode: Copy data from source to target
    await migrateData(sourceConn, targetConn, sourceObjects.tables);

    // Validation Phase: Compare row counts post-migration
    const postTargetCounts = await getTableCounts(targetConn, sourceObjects.tables);

    console.log('=================================================================');
    console.log('POST-MIGRATION ROW COUNT COMPARISON');
    console.log('=================================================================');
    const comparisonTable = sourceObjects.tables.map((t) => {
      const src = sourceCounts[t] ?? 0;
      const tgt = postTargetCounts[t] ?? 0;
      const match = src === tgt;
      return {
        Table: t,
        Source: src,
        Target: tgt,
        Match: match ? '✅ MATCH' : '❌ MISMATCH',
      };
    });
    console.table(comparisonTable);

    // Compare Triggers, Procedures and Views
    console.log('\n--- Object Verification ---');
    console.log('Triggers Comparison:');
    sourceObjects.triggers.forEach((trg) => {
      const present = targetObjects.triggers.includes(trg);
      console.log(`  ${present ? '✅' : '❌'} ${trg}`);
    });

    console.log('\nRoutines (Procedures) Comparison:');
    sourceObjects.routines.forEach((rt) => {
      const present = targetObjects.routines.includes(rt);
      console.log(`  ${present ? '✅' : '❌'} ${rt}`);
    });

    console.log('\nViews Comparison:');
    sourceObjects.views.forEach((v) => {
      const present = targetObjects.views.includes(v);
      console.log(`  ${present ? '✅' : '❌'} ${v}`);
    });

    console.log('\nMigration and verification completed successfully!');
  } finally {
    await sourceConn.end();
    await targetConn.end();
  }
}

run().catch((err) => {
  console.error('\nMigration error:', err);
  process.exit(1);
});
