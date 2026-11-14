import type { RowDataPacket } from 'mysql2/promise';
import { pool, queryRows } from '../config/db.js';

interface ExplainRow extends RowDataPacket {
  id: number;
  select_type: string;
  table: string;
  partitions?: string;
  type: string;
  possible_keys: string | null;
  key: string | null;
  key_len: string | null;
  ref: string | null;
  rows: number;
  filtered: number;
  Extra: string;
}

const queriesToAudit: { name: string; sql: string; params: (string | number)[] }[] = [
  {
    name: 'Live Monitor View (vw_ProctorLiveMonitor)',
    sql: 'SELECT * FROM vw_ProctorLiveMonitor WHERE status = ?',
    params: ['IN_PROGRESS'],
  },
  {
    name: 'Single Session Live Monitor Lookup',
    sql: 'SELECT * FROM vw_ProctorLiveMonitor WHERE session_id = ?',
    params: [1],
  },
  {
    name: 'Violation Audit Report View (vw_ViolationAuditReport)',
    sql: 'SELECT * FROM vw_ViolationAuditReport WHERE session_id = ? ORDER BY occurred_at DESC',
    params: [1],
  },
  {
    name: 'Exam Analytics View (vw_ExamAnalytics)',
    sql: 'SELECT * FROM vw_ExamAnalytics ORDER BY exam_id ASC',
    params: [],
  },
  {
    name: 'Violation Heatmap View (vw_ViolationHeatmap)',
    sql: 'SELECT * FROM vw_ViolationHeatmap',
    params: [],
  },
  {
    name: 'Admin All Graded Results Join',
    sql: `SELECT r.id AS result_id, r.session_id, r.raw_score, r.percentage, es.exam_id, u.full_name
          FROM Results r
          JOIN Exam_Sessions es ON es.id = r.session_id
          JOIN Exams e ON e.id = es.exam_id
          JOIN Users u ON u.id = es.student_id
          ORDER BY r.graded_at DESC`,
    params: [],
  },
  {
    name: 'Student Exam Questions + Responses Left Join',
    sql: `SELECT q.id, q.exam_id, q.question_text, sr.selected_option
          FROM Questions q
          LEFT JOIN Student_Responses sr ON sr.question_id = q.id AND sr.session_id = ?
          WHERE q.exam_id = ?
          ORDER BY q.id ASC`,
    params: [1, 1],
  },
  {
    name: 'Session Lookup by (exam_id, student_id)',
    sql: 'SELECT * FROM Exam_Sessions WHERE exam_id = ? AND student_id = ? LIMIT 1',
    params: [1, 5],
  },
  {
    name: 'Active Sessions Deadline Index Scan (AutoTimeout)',
    sql: 'SELECT id FROM Exam_Sessions WHERE status = ? AND server_deadline < NOW()',
    params: ['IN_PROGRESS'],
  },
];

async function runExplainAudit() {
  console.log('===============================================================');
  console.log('       PROCTORIQ DATABASE QUERY & EXPLAIN PLAN AUDIT           ');
  console.log('===============================================================\n');

  const summaryReport: Array<{
    name: string;
    durationMs: number;
    rowsExamined: number;
    keyUsed: string;
    scanType: string;
  }> = [];

  for (const q of queriesToAudit) {
    console.log(`Auditing: ${q.name}`);
    console.log(`Query: ${q.sql}`);

    // Run EXPLAIN
    const explainSql = `EXPLAIN ${q.sql}`;
    const plan = await queryRows<ExplainRow[]>(explainSql, q.params);
    console.table(
      plan.map((p) => ({
        table: p.table,
        type: p.type,
        possible_keys: p.possible_keys,
        key: p.key,
        rows: p.rows,
        filtered: `${p.filtered}%`,
        Extra: p.Extra,
      }))
    );

    // Profile execution time across 50 iterations
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      await pool.execute(q.sql, q.params);
    }
    const avgDuration = (performance.now() - start) / 50;

    const totalRowsExamined = plan.reduce((sum, p) => sum + (Number(p.rows) || 0), 0);
    const keysUsed = plan.map((p) => p.key).filter(Boolean).join(', ') || 'NONE';
    const scanTypes = Array.from(new Set(plan.map((p) => p.type))).join(', ');

    summaryReport.push({
      name: q.name,
      durationMs: Number(avgDuration.toFixed(3)),
      rowsExamined: totalRowsExamined,
      keyUsed: keysUsed,
      scanType: scanTypes,
    });

    console.log(`-> Avg latency (50 runs): ${avgDuration.toFixed(3)} ms | Keys: ${keysUsed}\n`);
  }

  console.log('---------------------------------------------------------------');
  console.log('                    AUDIT SUMMARY SUMMARY                      ');
  console.log('---------------------------------------------------------------');
  console.table(summaryReport);

  await pool.end();
}

runExplainAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
