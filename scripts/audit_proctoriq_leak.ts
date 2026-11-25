import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'proctoriq',
  });

  const [tables] = await pool.query('SHOW TABLES');
  const tableNames = (tables as any[]).map((r) => Object.values(r)[0]).sort();
  console.log('=== REAL DB (proctoriq) ROW COUNTS ===');
  for (const t of tableNames) {
    const [rows]: any = await pool.query(`SELECT COUNT(*) as count FROM ${t}`);
    console.log(`${(t as string).padEnd(25)}: ${rows[0].count}`);
  }

  // Measure uploads folder
  const uploadsDir = path.join(__dirname, '..', 'server', 'uploads');
  let fileCount = 0;
  let totalBytes = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    fileCount = files.length;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(uploadsDir, f));
        if (stat.isFile()) totalBytes += stat.size;
      } catch (e) {}
    }
  }
  console.log('\n=== REAL UPLOADS (server/uploads) ===');
  console.log(`Files: ${fileCount}, Total Bytes: ${totalBytes}`);

  // Leftover audit
  console.log('\n=== DRY RUN LEFTOVER AUDIT (proctoriq) ===');
  const [testUsers]: any = await pool.query(`
    SELECT user_id, name, email, role, created_at 
    FROM Users 
    WHERE email LIKE '%test%' OR email LIKE '%candidate%' OR name LIKE 'Test%' OR name LIKE 'Candidate%'
    ORDER BY user_id ASC
  `);
  console.log(`Found ${testUsers.length} test users in proctoriq:`);
  testUsers.forEach((u: any) => {
    console.log(`  [User ID ${u.user_id}] ${u.name} (${u.email}, ${u.role}) - created: ${u.created_at?.toISOString?.() ?? u.created_at}`);
  });

  const [testExams]: any = await pool.query(`
    SELECT exam_id, title, created_at 
    FROM Exams 
    WHERE title LIKE '%Test%' OR title LIKE '%Lifecycle%' OR title LIKE '%E2E%' OR title LIKE '%Stress%'
    ORDER BY exam_id ASC
  `);
  console.log(`\nFound ${testExams.length} test exams in proctoriq:`);
  testExams.forEach((e: any) => {
    console.log(`  [Exam ID ${e.exam_id}] ${e.title} - created: ${e.created_at?.toISOString?.() ?? e.created_at}`);
  });

  const [testSessions]: any = await pool.query(`
    SELECT s.session_id, s.exam_id, s.student_id, u.name, e.title, s.status, s.started_at 
    FROM Exam_Sessions s 
    JOIN Users u ON s.student_id = u.user_id 
    JOIN Exams e ON s.exam_id = e.exam_id 
    WHERE u.name LIKE 'Test%' OR u.name LIKE 'Candidate%' OR e.title LIKE '%Lifecycle%' OR e.title LIKE '%Test%'
    ORDER BY s.session_id ASC
  `);
  console.log(`\nFound ${testSessions.length} test sessions in proctoriq:`);
  testSessions.forEach((s: any) => {
    console.log(`  [Session ID ${s.session_id}] Candidate: ${s.name} | Exam: ${s.title} | Status: ${s.status} | Started: ${s.started_at?.toISOString?.() ?? s.started_at}`);
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
