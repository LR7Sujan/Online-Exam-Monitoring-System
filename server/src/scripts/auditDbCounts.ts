import mysql, { type RowDataPacket } from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Uploads folder audit
  const uploadsDir = path.resolve(__dirname, '../../../server/uploads');
  let uploadFilesCount = 0;
  let uploadTotalBytes = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    uploadFilesCount = files.length;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(uploadsDir, f));
        if (stat.isFile()) uploadTotalBytes += stat.size;
      } catch {
        // Ignored
      }
    }
  }

  console.log('\n=== REAL UPLOADS DIRECTORY (server/uploads) ===');
  console.log(`  Path: ${uploadsDir}`);
  console.log(`  Files count: ${uploadFilesCount}`);
  console.log(`  Total bytes: ${uploadTotalBytes}`);

  await connection.end();
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
