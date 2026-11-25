import mysql, { type RowDataPacket } from 'mysql2/promise';
import { getStorageAdapter } from '../storage/index.js';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'proctoriq_root',
    database: 'proctoriq',
  });

  const [tables] = await connection.query<RowDataPacket[]>('SHOW TABLES');
  const tableNames = tables.map((r) => Object.values(r)[0] as string).sort();

  console.log('=== REAL DATABASE (proctoriq) TABLE ROW COUNTS ===');
  const counts: Record<string, number> = {};
  for (const t of tableNames) {
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    counts[t] = Number(rows[0].cnt);
    console.log(`  ${t.padEnd(25)}: ${rows[0].cnt}`);
  }

  // Storage audit
  let uploadFilesCount = 0;
  let uploadTotalBytes = 0;
  try {
    const items = await getStorageAdapter().list();
    uploadFilesCount = items.length;
    uploadTotalBytes = items.reduce((acc, curr) => acc + curr.size, 0);
  } catch {
    // Ignored
  }

  console.log('\n=== OBJECT STORAGE EVIDENCE INVENTORY ===');
  console.log(`  Items count: ${uploadFilesCount}`);
  console.log(`  Total bytes: ${uploadTotalBytes}`);

  await connection.end();
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
