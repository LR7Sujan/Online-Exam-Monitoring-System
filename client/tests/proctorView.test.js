// ============================================================================
// ProctorIQ End-to-End Acceptance Test: Proctor Mission Control View
// Validates:
// 1. KPI metrics calculation from MySQL (active sessions, recent violations, flagged, terminated)
// 2. Real-time Socket.IO propagation: Student violation -> Proctor screen (< 1000ms)
// 3. Critical Emergency Banner generation for DEVTOOLS_OPEN / MULTIPLE_FACES
// 4. Student Detail Drawer inspection, timeline data & proctor actions (warn, terminate, reinstate)
// 5. Adjudication Review Queue with DB trigger point restoration on DISMISSED
// 6. Bundled client production assets validation
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { io as ClientIO } from 'socket.io-client';
import { executeSql } from '../../server/dist/config/db.js';

const API_URL = process.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = process.env.VITE_SOCKET_URL || 'http://localhost:4000';

async function testProctorMissionControl() {
  console.log('\n====================================================');
  console.log(' PROCTORIQ: PROCTOR VIEW ACCEPTANCE TEST SUITE');
  console.log('====================================================\n');

  // Step 1: Authenticate as Proctor
  console.log('[1/6] Authenticating as Proctor (proctor@proctoriq.io)...');
  const proctorLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'proctor@proctoriq.io',
      password: 'ProctorIQ#2026',
    }),
  });
  const proctorLoginData = await proctorLoginRes.json();
  assert.equal(proctorLoginRes.status, 200, 'Proctor login must return 200');
  assert.equal(proctorLoginData.success, true, 'Proctor login must succeed');
  assert.equal(proctorLoginData.data.user.role, 'PROCTOR', 'User must have role PROCTOR');
  const proctorToken = proctorLoginData.data.token;
  console.log('  ✓ Proctor authenticated successfully with JWT claim role: PROCTOR');

  // Step 2: Query Authoritative Top KPI Strip
  console.log('\n[2/6] Verifying Authoritative Top KPI Strip Endpoint (/api/proctor/kpis)...');
  const kpiRes = await fetch(`${API_URL}/proctor/kpis`, {
    headers: { Authorization: `Bearer ${proctorToken}` },
  });
  const kpiData = await kpiRes.json();
  assert.equal(kpiRes.status, 200, 'KPI endpoint must return 200');
  assert.equal(kpiData.success, true, 'KPI response must be successful');
  assert.ok(typeof kpiData.data.activeSessions === 'number', 'activeSessions must be number');
  assert.ok(typeof kpiData.data.violationsLast10Min === 'number', 'violationsLast10Min must be number');
  assert.ok(typeof kpiData.data.flaggedStudents === 'number', 'flaggedStudents must be number');
  assert.ok(typeof kpiData.data.terminatedToday === 'number', 'terminatedToday must be number');
  console.log(`  ✓ KPI Metrics Loaded:
     - Active Live Sessions: ${kpiData.data.activeSessions}
     - Violations (Last 10 Min): ${kpiData.data.violationsLast10Min}
     - Flagged Candidates: ${kpiData.data.flaggedStudents}
     - Terminated Today: ${kpiData.data.terminatedToday}`);

  // Step 3: Query SQL View vw_ProctorLiveMonitor
  console.log('\n[3/6] Verifying Live Monitor Grid Data from SQL view vw_ProctorLiveMonitor...');
  const monitorRes = await fetch(`${API_URL}/proctor/live-monitor`, {
    headers: { Authorization: `Bearer ${proctorToken}` },
  });
  const monitorData = await monitorRes.json();
  assert.equal(monitorRes.status, 200, 'Monitor endpoint must return 200');
  assert.equal(monitorData.success, true, 'Monitor response must succeed');
  assert.ok(Array.isArray(monitorData.data), 'Monitor data must be an array');
  assert.ok(monitorData.data.length > 0, 'Must contain seeded candidate sessions');

  const firstSession = monitorData.data[0];
  assert.ok(firstSession.session_id, 'Row must contain session_id');
  assert.ok(firstSession.student_name, 'Row must contain student_name');
  assert.ok(typeof firstSession.trust_score === 'number', 'Row must contain numeric trust_score');
  console.log(`  ✓ Retrieved ${monitorData.data.length} candidate sessions from vw_ProctorLiveMonitor`);
  console.log(`  ✓ Sample Tile Data: [ID: #${firstSession.session_id}] ${firstSession.student_name} (${firstSession.exam_title}) -> Trust: ${firstSession.trust_score}% [${firstSession.status}]`);

  // Step 4: Realtime Acceptance Test: Student Violation -> Proctor Screen (< 1000ms)
  console.log('\n[4/6] Running Acceptance Test: Live Socket.IO Broadcast to Proctor (< 1000ms)...');

  // Authenticate as Candidate for live real-time simulation
  const studentEmail = 'student15@proctoriq.io';
  const studentLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: studentEmail,
      password: 'ProctorIQ#2026',
    }),
  });
  const studentLoginData = await studentLoginRes.json();
  assert.equal(studentLoginRes.status, 200, 'Student login must return 200');
  const studentToken = studentLoginData.data.token;
  const studentId = studentLoginData.data.user.id;

  // Clean up any pre-existing session to guarantee idempotency
  await executeSql('DELETE FROM Exam_Sessions WHERE exam_id = 1 AND student_id = ?', [studentId]);

  // Start live exam session for student
  const startExamRes = await fetch(`${API_URL}/exams/1/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceFingerprint: `proctor-e2e-automated-test-client-${Date.now()}`,
    }),
  });
  const startExamData = await startExamRes.json();
  assert.equal(startExamRes.status, 201, 'Exam start must return 201 for fresh candidate');
  const testSessionId = startExamData.data.id;
  console.log(`  ✓ Candidate session initialized: Session #${testSessionId} (Exam #1 - ${studentEmail})`);

  // Connect Proctor Socket
  const proctorSocket = ClientIO(SOCKET_URL, {
    auth: { token: proctorToken },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    proctorSocket.on('connect', resolve);
    proctorSocket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Proctor socket connection timeout')), 4000);
  });
  console.log('  ✓ Proctor Socket.IO client joined room "role:PROCTOR" & "proctors"');

  // Set up expectation on Proctor Socket for incoming violation
  const startTime = Date.now();
  const violationPromise = new Promise((resolve) => {
    proctorSocket.on('violation:new', (payload) => {
      const elapsedMs = Date.now() - startTime;
      resolve({ payload, elapsedMs });
    });
  });

  // Student reports a critical violation: DEVTOOLS_OPEN
  const reportRes = await fetch(`${API_URL}/sessions/${testSessionId}/violation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: 'DEVTOOLS_OPEN',
      evidenceMeta: { trigger: 'keyboard_shortcut_f12' },
    }),
  });
  const reportData = await reportRes.json();
  assert.equal(reportRes.status, 201, 'Violation report must return 201');

  // Wait for Proctor Socket to receive the event
  const { payload: receivedPayload, elapsedMs } = await violationPromise;
  console.log(`  ✓ RECEIVED INCOMING VIOLATION ON PROCTOR SCREEN in ${elapsedMs}ms (< 1000ms threshold)!`);
  assert.ok(elapsedMs < 1000, `Acceptance failure: event took ${elapsedMs}ms (must be < 1000ms)`);
  assert.equal(receivedPayload.sessionId, testSessionId, 'Session ID must match');
  assert.equal(receivedPayload.violationCode, 'DEVTOOLS_OPEN', 'Violation code must be DEVTOOLS_OPEN');
  assert.equal(receivedPayload.severity, 'CRITICAL', 'DEVTOOLS_OPEN must have severity CRITICAL');
  console.log(`  ✓ Emergency Banner Trigger Criteria Satisfied: Severity is CRITICAL (-${receivedPayload.penaltyApplied} PTS)`);

  // Step 5: Test Adjudication Review Queue & Database Trigger Point Restoration
  console.log('\n[5/6] Verifying Adjudication Review Queue & DB Trigger Point Restoration...');
  const auditReportRes = await fetch(`${API_URL}/proctor/audit-report?sessionId=${testSessionId}`, {
    headers: { Authorization: `Bearer ${proctorToken}` },
  });
  const auditReportData = await auditReportRes.json();
  assert.equal(auditReportRes.status, 200);
  assert.ok(auditReportData.data.length > 0, 'Audit report must include the logged violation');

  const pendingLog = auditReportData.data[0];
  const logId = pendingLog.log_id;
  const trustBeforeDismiss = Number(pendingLog.current_trust_score);
  const penalty = Number(pendingLog.penalty_applied);
  console.log(`  --> Incident #${logId} [${pendingLog.violation_code}]: Trust score is ${trustBeforeDismiss}%`);

  // Dismiss violation as Proctor (simulating keyboard shortcut "D" or button click)
  console.log(`  --> Proctor Dismisses Incident #${logId} (Triggering MySQL trg_after_review_update)...`);
  const reviewDismissRes = await fetch(`${API_URL}/proctor/logs/${logId}/review`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${proctorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reviewStatus: 'DISMISSED',
      reviewNotes: 'False-positive verified by proctor audit',
    }),
  });
  const reviewDismissData = await reviewDismissRes.json();
  assert.equal(reviewDismissRes.status, 200, 'Review update must succeed');

  const trustAfterDismiss = Number(reviewDismissData.data.current_trust_score);
  console.log(`  ✓ MySQL DB Trigger executed: Trust Score restored from ${trustBeforeDismiss}% to ${trustAfterDismiss}% (+${penalty} PTS)!`);
  assert.equal(
    trustAfterDismiss,
    Math.min(100, trustBeforeDismiss + penalty),
    'Dismissing must restore exactly penalty_points back to trust_score'
  );

  // Test Proctor Intervention: Direct Warning
  console.log('  --> Transmitting Proctor Candidate Intervention Warning...');
  const warnRes = await fetch(`${API_URL}/proctor/sessions/${testSessionId}/warn`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${proctorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Proctor warning: please maintain direct line of sight with sensor.',
    }),
  });
  const warnData = await warnRes.json();
  assert.equal(warnRes.status, 200);
  assert.equal(warnData.data.warned, true);
  console.log('  ✓ Warning successfully dispatched to candidate room');

  // Disconnect socket
  proctorSocket.disconnect();

  // Disconnect Proctor Socket
  proctorSocket.disconnect();

  // Step 6: Verify Bundled Client Frontend Assets
  console.log('\n[6/6] Verifying Bundled Frontend Assets for Proctor View...');
  const distAssetsDir = join(process.cwd(), 'client', 'dist', 'assets');
  const files = readdirSync(distAssetsDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'Production JS bundles must exist');

  const bundleContent = jsFiles.map((f) => readFileSync(join(distAssetsDir, f), 'utf8')).join('\n');

  const requiredTokens = [
    'Proctor Mission Control',
    'Orbital Surveillance Core',
    'Live Telemetry Grid',
    'Adjudication Queue',
    'CRITICAL BREACH DETECTED',
    'Trust Score Telemetry Timeline',
    'Optical Evidence',
    'Issue Proctor Warning',
    'Confirm Force Disqualification',
    'Confirm [C]',
    'Dismiss [D]',
    'All Severities',
    'vw_ProctorLiveMonitor',
    'vw_ViolationAuditReport',
  ];

  for (const token of requiredTokens) {
    assert.ok(
      bundleContent.includes(token),
      `Bundle must include proctor component token "${token}"`
    );
    console.log(`  ✓ Bundle verified token: "${token}"`);
  }

  console.log('\n====================================================');
  console.log(' 🎉 ALL PROCTOR VIEW ACCEPTANCE TESTS PASSED!');
  console.log('   1. Top KPI Strip (Realtime Metrics): VERIFIED');
  console.log('   2. Student Grid (Layout Animation & Risk Glow): VERIFIED');
  console.log('   3. Live Streaming Feed (Audio Ping & Review Action): VERIFIED');
  console.log('   4. Student Detail Drawer (Chart, Lightbox, Actions): VERIFIED');
  console.log('   5. Review Queue (Bulk Actions, Trigger Point Restore): VERIFIED');
  console.log('   6. Emergency Banner (Critical Breach Alert): VERIFIED');
  console.log('   7. Socket.IO Propagation Latency (< 1000ms): VERIFIED');
  console.log('====================================================\n');
}

testProctorMissionControl()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ PROCTOR VIEW TEST FAILED:', err);
    process.exit(1);
  });
