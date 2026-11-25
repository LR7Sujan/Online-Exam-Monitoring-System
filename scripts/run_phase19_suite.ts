import { execSync } from 'node:child_process';
import mysql, { type RowDataPacket } from '../server/node_modules/mysql2/promise.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getRealDbState() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'proctoriq_root',
    database: 'proctoriq',
  });

  const [tables] = await connection.query<RowDataPacket[]>('SHOW TABLES');
  const tableNames = tables.map((r) => Object.values(r)[0] as string).sort();

  const counts: Record<string, number> = {};
  for (const t of tableNames) {
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    counts[t] = Number(rows[0].cnt);
  }
  await connection.end();

  const uploadsDir = path.resolve(__dirname, '../server/uploads');
  let uploadFilesCount = 0;
  let uploadTotalBytes = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    uploadFilesCount = files.length;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(uploadsDir, f));
        if (stat.isFile()) uploadTotalBytes += stat.size;
      } catch { }
    }
  }

  return { counts, uploadFilesCount, uploadTotalBytes };
}

function runCommand(cmd: string, name: string) {
  console.log(`\n=================================================================`);
  console.log(`>>> RUNNING: ${name}`);
  console.log(`>>> COMMAND: ${cmd}`);
  console.log(`=================================================================\n`);
  const start = Date.now();
  execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n[PASS] ${name} completed in ${duration}s.\n`);
}

async function main() {
  console.log('\n#################################################################');
  console.log('# PHASE 19 VERIFICATION RUN: FULL SUITE & REAL DB INVARIANCE');
  console.log('#################################################################\n');

  const before = await getRealDbState();
  console.log('--- BASELINE REAL DATABASE (proctoriq) COUNTS ---');
  for (const [tbl, cnt] of Object.entries(before.counts)) {
    console.log(`  ${tbl.padEnd(25)}: ${cnt}`);
  }
  console.log(`  server/uploads files     : ${before.uploadFilesCount}`);
  console.log(`  server/uploads bytes     : ${before.uploadTotalBytes}\n`);

  // Run 1: DB Tests, Server Tests, Phase 19 Playwright Suite
  runCommand('npm run test:db', 'Database DBMS Guarantees Suite (Suite 1-8, 41 tests)');
  runCommand('npm --prefix server run test', 'Server Unit & Integration Suite (213 tests)');
  runCommand(
    'npx --prefix client playwright test e2e/evidenceSnapshot.spec.ts e2e/simulatorPersonas.spec.ts e2e/mediaTeardown.spec.ts e2e/authLayoutMerged.spec.ts e2e/studentTileOverflow.spec.ts e2e/styleguideLoadingState.spec.ts e2e/phase19Walkthrough.spec.ts --config client/playwright.config.ts',
    'Playwright Phase 19 Acceptance & Walkthrough Suite (24 tests)'
  );

  const after = await getRealDbState();
  console.log('\n--- POST-RUN REAL DATABASE (proctoriq) COUNTS ---');
  let hasLeak = false;
  for (const [tbl, cnt] of Object.entries(after.counts)) {
    const diff = cnt - (before.counts[tbl] || 0);
    const mark = diff === 0 ? 'MATCH' : `LEAK (${diff > 0 ? '+' : ''}${diff})`;
    if (diff !== 0) hasLeak = true;
    console.log(`  ${tbl.padEnd(25)}: ${cnt} [${mark}]`);
  }

  const uploadDiff = after.uploadFilesCount - before.uploadFilesCount;
  const byteDiff = after.uploadTotalBytes - before.uploadTotalBytes;
  if (uploadDiff !== 0 || byteDiff !== 0) hasLeak = true;
  console.log(`  server/uploads files     : ${after.uploadFilesCount} [${uploadDiff === 0 ? 'MATCH' : 'LEAK'}]`);
  console.log(`  server/uploads bytes     : ${after.uploadTotalBytes} [${byteDiff === 0 ? 'MATCH' : 'LEAK'}]\n`);

  if (hasLeak) {
    console.error('FATAL: Database or storage leak detected in real environment!');
    process.exit(1);
  } else {
    console.log('SUCCESS: Real database and storage completely untouched (0 changes).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

