import mysql from '../server/node_modules/mysql2/promise.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'proctoriq_root',
    database: 'proctoriq',
  });

  const codes = ['PHONE_DETECTED', 'MULTIPLE_FACES', 'NO_FACE'];
  for (const code of codes) {
    const [rows] = await conn.query<any[]>(
      `SELECT pl.id, pl.session_id, vt.code, pl.snapshot_url, pl.evidence_meta
       FROM Proctoring_Logs pl
       JOIN Violation_Types vt ON vt.id = pl.violation_type_id
       WHERE vt.code = ?
       ORDER BY pl.id DESC
       LIMIT 1`,
      [code]
    );

    console.log(`\n=== Violation Code: ${code} ===`);
    if (rows.length === 0) {
      console.log('No logs found for this code in real DB.');
      continue;
    }
    const row = rows[0];
    console.log('Log ID:', row.id);
    console.log('Session ID:', row.session_id);
    console.log('Stored snapshot_url:', row.snapshot_url);

    if (row.snapshot_url) {
      const cleanPath = row.snapshot_url.replace('/uploads/', '');
      const filePath = path.join(process.cwd(), 'server', 'uploads', cleanPath);
      const exists = fs.existsSync(filePath);
      console.log('File path checked:', filePath);
      console.log('File exists on disk:', exists);
      if (exists) {
        const stat = fs.statSync(filePath);
        console.log('File size (bytes):', stat.size);
        const buf = fs.readFileSync(filePath);
        console.log('Header hex (first 16 bytes):', buf.subarray(0, 16).toString('hex'));
      }
    }
  }

  await conn.end();
}

main().catch(console.error);
