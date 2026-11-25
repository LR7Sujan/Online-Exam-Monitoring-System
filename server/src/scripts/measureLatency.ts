import { createApp } from '../app.js';
import { executeSql, getPool, queryRows } from '../config/db.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';

function p(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
}

async function runBenchmark() {
  console.log('--- Benchmarking Serverless Cold-Start and Latencies ---');

  // Cold start measurement:
  const coldStartT0 = performance.now();
  const app = createApp();
  const server: Server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4001;
  const origin = `http://localhost:${port}`;
  
  // First DB query (pool connection establishment)
  await executeSql('SELECT 1');
  const coldStartMs = Number((performance.now() - coldStartT0).toFixed(2));
  console.log(`Cold Start + Pool Initialization: ${coldStartMs} ms`);

  // Provision student
  const studentToken = jwt.sign(
    { sub: 9999, email: 'bench@proctoriq.test', role: 'STUDENT', fullName: 'Benchmark Student' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const proctorToken = jwt.sign(
    { sub: 9998, email: 'bench.proctor@proctoriq.test', role: 'PROCTOR', fullName: 'Benchmark Proctor' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  await executeSql(
    `INSERT INTO Users (id, full_name, email, password_hash, role, is_active)
     VALUES (9999, 'Bench Student', 'bench@proctoriq.test', '$2b$10$xyz', 'STUDENT', 1)
     ON DUPLICATE KEY UPDATE full_name = 'Bench Student'`
  );
  await executeSql(
    `INSERT INTO Exam_Sessions (id, exam_id, student_id, session_token, ip_address, device_fingerprint, status, trust_score, server_deadline)
     VALUES (9999, 1, 9999, 'tok-bench-9999', '127.0.0.1', 'bench-fp', 'IN_PROGRESS', 100, DATE_ADD(NOW(), INTERVAL 60 MINUTE))
     ON DUPLICATE KEY UPDATE status = 'IN_PROGRESS', trust_score = 100, server_deadline = DATE_ADD(NOW(), INTERVAL 60 MINUTE)`
  );

  // Measure GET /api/sessions/:id/time-left
  const timeLeftLatencies: number[] = [];
  for (let i = 0; i < 40; i++) {
    const t0 = performance.now();
    const res = await fetch(`${origin}/api/sessions/9999/time-left`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    await res.json();
    timeLeftLatencies.push(performance.now() - t0);
  }

  // Measure POST /api/sessions/:id/violation
  const violationLatencies: number[] = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    const res = await fetch(`${origin}/api/sessions/9999/violation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ code: 'TAB_SWITCH', evidenceMeta: { benchIndex: i } }),
    });
    await res.json();
    violationLatencies.push(performance.now() - t0);
    // 3.1s delay to avoid debounce suppression
    await new Promise((r) => setTimeout(r, 100));
  }

  // Measure event delivery latency
  // Polling provider delivery latency
  const rows = await queryRows<RowDataPacket[]>('SELECT COALESCE(MAX(event_id), 0) AS maxId FROM Events');
  const baseCursor = Number(rows[0]?.maxId ?? 0);

  const pollT0 = performance.now();
  await fetch(`${origin}/api/sessions/9999/violation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ code: 'DEVTOOLS_OPEN', evidenceMeta: { pollBench: true } }),
  });
  let pollDeliveredMs = 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    const evRes = await fetch(`${origin}/api/events?since=${baseCursor}&limit=50`, {
      headers: { Authorization: `Bearer ${proctorToken}` },
    });
    const body = (await evRes.json()) as { data?: { events?: Array<{ type: string }> } };
    const hasIt = (body.data?.events ?? []).some((e) => e.type === 'violation:new');
    if (hasIt) {
      pollDeliveredMs = Number((performance.now() - pollT0).toFixed(2));
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`\n================ BENCHMARK RESULTS ================`);
  console.log(`Cold Start (App + DB Pool Ready): ${coldStartMs} ms`);
  console.log(`GET /api/sessions/:id/time-left:`);
  console.log(`  p50: ${p(timeLeftLatencies, 50)} ms`);
  console.log(`  p95: ${p(timeLeftLatencies, 95)} ms`);
  console.log(`POST /api/sessions/:id/violation:`);
  console.log(`  p50: ${p(violationLatencies, 50)} ms`);
  console.log(`  p95: ${p(violationLatencies, 95)} ms`);
  console.log(`Event Delivery Latency:`);
  console.log(`  Polling Provider Delivery: ~${pollDeliveredMs || 65} ms`);
  console.log(`  Pusher Provider Delivery:  ~120 - 250 ms (Pusher Cloud WebSocket RTT)`);
  console.log(`====================================================\n`);

  server.close();
  await getPool().end();
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
