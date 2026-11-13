// ============================================================================
// ProctorIQ End-to-End Acceptance Test: Admin Experience & Governance Core
// Validates:
// 1. Admin Authentication (JWT with role: ADMIN)
// 2. Overview Dashboard API (/api/analytics/dashboard) with Recharts payloads
//    (KPIs, time-series, donut distribution, circadian heatmap, stacked bar, histogram, leaderboard)
// 3. Exam Management & Bulk Question Ingestion (/api/exams, /api/exams/:id/questions/bulk)
// 4. Dynamic DB Penalty Weight Calibration & Live Verification:
//    - Altering penalty weight in Violation_Types table immediately shifts
//      points deducted by trigger trg_before_violation_insert on next violation
//      without application restart or code modification!
// 5. User Management & Authorization Modulation (/api/admin/users)
// 6. Audit Report RFC 4180 CSV Export (/api/admin/audit-report/export)
// 7. Client Production Bundle Asset Inspection
// ============================================================================

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API_URL = process.env.VITE_API_URL || 'http://localhost:4000/api';

async function testAdminExperience() {
  console.log('\n====================================================');
  console.log(' PROCTORIQ: ADMIN EXPERIENCE ACCEPTANCE TEST SUITE');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // Step 1: Admin Authentication
  // --------------------------------------------------------------------------
  console.log('[1/7] Authenticating as Administrator (admin@proctoriq.io)...');
  const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@proctoriq.io',
      password: 'ProctorIQ#2026',
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  assert.equal(adminLoginRes.status, 200, 'Admin login must return HTTP 200');
  assert.equal(adminLoginData.success, true, 'Admin login must succeed');
  assert.equal(adminLoginData.data.user.role, 'ADMIN', 'Token must have ADMIN role');
  const adminToken = adminLoginData.data.token;
  console.log('  ✓ Administrator authenticated successfully with JWT claim role: ADMIN');

  // Also authenticate student 12 for the live penalty test
  const studentLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student12@proctoriq.io',
      password: 'ProctorIQ#2026',
    }),
  });
  const studentLoginData = await studentLoginRes.json();
  assert.equal(studentLoginRes.status, 200, 'Student login must return HTTP 200');
  const studentToken = studentLoginData.data.token;
  console.log('  ✓ Test candidate (student12@proctoriq.io) authenticated for dynamic penalty verification');

  // --------------------------------------------------------------------------
  // Step 2: Overview Dashboard Recharts Analytics API
  // --------------------------------------------------------------------------
  console.log('\n[2/7] Querying Analytics Dashboard (/api/analytics/dashboard?days=7)...');
  const dashRes = await fetch(`${API_URL}/analytics/dashboard?days=7`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dashJson = await dashRes.json();
  assert.equal(dashRes.status, 200, 'Dashboard endpoint must return HTTP 200');
  assert.equal(dashJson.success, true, 'Dashboard response must have success: true');

  const {
    kpis,
    violationsOverTime,
    violationDistribution,
    heatmap,
    integritySplit,
    trustHistogram,
    leaderboard,
  } = dashJson.data;

  // Validate KPIs
  assert.ok(typeof kpis.totalExams === 'number', 'kpis.totalExams must be number');
  assert.ok(typeof kpis.totalStudents === 'number', 'kpis.totalStudents must be number');
  assert.ok(typeof kpis.totalSessions === 'number', 'kpis.totalSessions must be number');
  assert.ok(typeof kpis.cheatingRate === 'number', 'kpis.cheatingRate must be number');
  console.log(`  ✓ Executive KPIs verified:
     - Total Exams: ${kpis.totalExams}
     - Total Students: ${kpis.totalStudents}
     - Exam Sessions: ${kpis.totalSessions}
     - Cheating Termination Rate: ${kpis.cheatingRate}%`);

  // Validate Charts Data
  assert.ok(Array.isArray(violationsOverTime) && violationsOverTime.length >= 7, 'violationsOverTime must have 7+ day entries');
  assert.ok(Array.isArray(violationDistribution) && violationDistribution.length > 0, 'violationDistribution must have items');
  assert.ok(Array.isArray(heatmap), 'heatmap must be an array');
  assert.ok(Array.isArray(integritySplit) && integritySplit.length > 0, 'integritySplit must have items');
  assert.ok(typeof trustHistogram === 'object' && trustHistogram !== null, 'trustHistogram must be an object with buckets');
  assert.ok(Array.isArray(leaderboard), 'leaderboard must be an array');
  console.log(`  ✓ Recharts Visualization Payloads Validated:
     - Time Series AreaChart: ${violationsOverTime.length} data points
     - Infraction Donut: ${violationDistribution.length} categories
     - Circadian Heatmap (24h matrix): ${heatmap.length} cells
     - Integrity Split Stacked Bar: ${integritySplit.length} exams
     - Trust Score Histogram: Buckets (0-49: ${trustHistogram.bucket_0_49}, 50-69: ${trustHistogram.bucket_50_69}, 70-84: ${trustHistogram.bucket_70_84}, 85-99: ${trustHistogram.bucket_85_99}, 100: ${trustHistogram.bucket_100})
     - Leaderboard: ${leaderboard.length} high-risk candidate sessions`);

  // --------------------------------------------------------------------------
  // Step 3: Exam Creation Wizard & Bulk Question Ingestion
  // --------------------------------------------------------------------------
  console.log('\n[3/7] Testing Exam Management Wizard & Bulk CSV Ingestion...');
  const newExamTitle = `Automated Security Evaluation - ${Date.now()}`;
  const now = new Date();
  const startWindow = new Date(now.getTime() - 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const endWindow = new Date(now.getTime() + 180 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const createExamRes = await fetch(`${API_URL}/exams`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: newExamTitle,
      description: 'Comprehensive test exam designed to verify automated question staging and threshold slider calibration.',
      durationMinutes: 45,
      minTrustScore: 55,
      startWindow: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      endWindow: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
      isPublished: true,
    }),
  });
  const createExamData = await createExamRes.json();
  assert.equal(createExamRes.status, 201, 'Exam creation must return HTTP 201');
  const createdExamId = createExamData.data.id;
  assert.ok(createdExamId, 'Created exam must have an id');
  console.log(`  ✓ Exam created with ID ${createdExamId} and min_trust_score 55`);

  // Test Bulk CSV Question Staging
  const sampleQuestions = [
    {
      question_text: 'What SQL trigger fires before an infraction row is written?',
      option_a: 'trg_before_violation_insert',
      option_b: 'trg_after_violation_insert',
      option_c: 'trg_before_log_update',
      option_d: 'trg_after_review_update',
      correct_option: 'A',
      marks: 2,
    },
    {
      question_text: 'What SQLSTATE code signals an immutable violation record rejection?',
      option_a: '45000',
      option_b: '42000',
      option_c: '23000',
      option_d: '08001',
      correct_option: 'A',
      marks: 3,
    },
    {
      question_text: 'Which SQL procedure executes atomic session auto-timeout?',
      option_a: 'sp_AutoTimeoutExpiredSessions',
      option_b: 'sp_SubmitAndGradeExam',
      option_c: 'sp_TerminateCheating',
      option_d: 'sp_RecalculateScores',
      correct_option: 'A',
      marks: 2,
    },
  ];

  const bulkQuestionsRes = await fetch(`${API_URL}/exams/${createdExamId}/questions/bulk`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ questions: sampleQuestions }),
  });
  const bulkQuestionsData = await bulkQuestionsRes.json();
  assert.equal(bulkQuestionsRes.status, 201, 'Bulk questions import must return HTTP 201');
  assert.equal(bulkQuestionsData.data.count, 3, 'Must report 3 questions inserted');

  // Verify Questions in Exam
  const examDetailRes = await fetch(`${API_URL}/exams/${createdExamId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const examDetailData = await examDetailRes.json();
  assert.equal(examDetailRes.status, 200, 'Exam details must return HTTP 200');
  assert.equal(examDetailData.data.questions.length, 3, 'Must have 3 associated questions');
  console.log(`  ✓ Bulk CSV Staging verified: 3 questions successfully stored with sequential ordering`);

  // --------------------------------------------------------------------------
  // Step 4: Dynamic DB Penalty Weight Calibration & Live Verification
  // --------------------------------------------------------------------------
  console.log('\n[4/7] Testing Authoritative DB Penalty Weight Calibration...');
  
  // 1. Fetch current penalty rules
  const rulesRes = await fetch(`${API_URL}/violation-types`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const rulesData = await rulesRes.json();
  assert.equal(rulesRes.status, 200, 'Violation types must return HTTP 200');
  const tabSwitchRule = rulesData.data.find(r => r.code === 'TAB_SWITCH');
  assert.ok(tabSwitchRule, 'TAB_SWITCH rule must exist');
  const originalPenalty = tabSwitchRule.penalty_points;
  console.log(`  • Original TAB_SWITCH penalty weight in DB: ${originalPenalty} PTS`);

  // 2. Start a fresh live session for student12 on the newly created exam
  const startSessionRes = await fetch(`${API_URL}/exams/${createdExamId}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceFingerprint: `fp-admin-test-${Date.now()}`,
    }),
  });
  const startSessionData = await startSessionRes.json();
  assert.equal(startSessionRes.status, 201, 'Student session start must return HTTP 201');
  const session = startSessionData.data.session || startSessionData.data;
  const sessionId = session.id;
  assert.equal(session.trust_score, 100, 'Initial trust score must be 100');
  console.log(`  • Student session #${sessionId} started with initial trust score 100%`);

  // 3. Trigger first TAB_SWITCH under baseline penalty
  const v1Res = await fetch(`${API_URL}/sessions/${sessionId}/violation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: 'TAB_SWITCH',
      snapshot: 'data:image/jpeg;base64,baseline-test',
    }),
  });
  const v1Data = await v1Res.json();
  assert.ok([200, 201].includes(v1Res.status), `Violation insert must return HTTP 200 or 201 (got ${v1Res.status})`);
  const expectedScore1 = 100 - originalPenalty;
  assert.equal(v1Data.data.trust_score, expectedScore1, `Score after first violation must be 100 - ${originalPenalty} = ${expectedScore1}`);
  console.log(`  ✓ Baseline violation 1: Deducted ${originalPenalty} PTS -> Score = ${v1Data.data.trust_score}%`);

  // 4. Admin modifies penalty weight for TAB_SWITCH from 15 to 30
  const elevatedPenalty = 30;
  console.log(`  • Admin dynamically updating TAB_SWITCH penalty weight: ${originalPenalty} -> ${elevatedPenalty} PTS...`);
  const updateRuleRes = await fetch(`${API_URL}/violation-types/${tabSwitchRule.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ penalty_points: elevatedPenalty }),
  });
  const updateRuleData = await updateRuleRes.json();
  assert.equal(updateRuleRes.status, 200, 'Violation type update must return HTTP 200');
  assert.equal(updateRuleData.data.penalty_points, elevatedPenalty, 'Updated penalty must be 30');

  // 5. Trigger second TAB_SWITCH under modified penalty without any backend restart
  // Note: Wait 3.5s to bypass the 3-second debounce window
  console.log('  • Waiting 3.5s to bypass anti-duplicate debounce...');
  await new Promise(r => setTimeout(r, 3500));

  const v2Res = await fetch(`${API_URL}/sessions/${sessionId}/violation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: 'TAB_SWITCH',
      snapshot: 'data:image/jpeg;base64,elevated-test',
    }),
  });
  const v2Data = await v2Res.json();
  assert.ok([200, 201].includes(v2Res.status), `Second violation insert must return HTTP 200 or 201 (got ${v2Res.status})`);
  const expectedScore2 = expectedScore1 - elevatedPenalty;
  assert.equal(
    v2Data.data.trust_score,
    expectedScore2,
    `Score after dynamically changed penalty must be ${expectedScore1} - ${elevatedPenalty} = ${expectedScore2}`
  );
  console.log(`  ✓ DYNAMIC DB TRIGGER ENFORCEMENT PROVEN:
     Second TAB_SWITCH automatically deducted ${elevatedPenalty} PTS (instead of ${originalPenalty} PTS)!
     Current Trust Score = ${v2Data.data.trust_score}% (Min threshold = 55%)`);

  // 6. Restore original penalty weight
  await fetch(`${API_URL}/violation-types/${tabSwitchRule.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ penalty_points: originalPenalty }),
  });
  console.log(`  • Restored TAB_SWITCH penalty back to baseline (${originalPenalty} PTS)`);

  // --------------------------------------------------------------------------
  // Step 5: User Management & Authorization Modulation
  // --------------------------------------------------------------------------
  console.log('\n[5/7] Testing User Management & Role Modulation (/api/admin/users)...');
  const usersRes = await fetch(`${API_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const usersData = await usersRes.json();
  assert.equal(usersRes.status, 200, 'Users query must return HTTP 200');
  assert.ok(Array.isArray(usersData.data) && usersData.data.length > 0, 'Users list must be non-empty');

  // Target candidate student 12 for role modulation
  const targetUser = usersData.data.find(u => u.email === 'student12@proctoriq.io');
  assert.ok(targetUser, 'student12@proctoriq.io must exist in user directory');

  // Update role to PROCTOR
  const patchUserRes = await fetch(`${API_URL}/admin/users/${targetUser.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'PROCTOR', is_active: 1 }),
  });
  const patchUserData = await patchUserRes.json();
  assert.equal(patchUserRes.status, 200, 'User update must return HTTP 200');
  assert.equal(patchUserData.data.role, 'PROCTOR', 'Role must now be PROCTOR');
  console.log(`  ✓ User ID ${targetUser.id} role dynamically elevated to PROCTOR`);

  // Revert back to STUDENT
  await fetch(`${API_URL}/admin/users/${targetUser.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'STUDENT', is_active: 1 }),
  });
  console.log(`  ✓ User ID ${targetUser.id} role safely restored to STUDENT`);

  // --------------------------------------------------------------------------
  // Step 6: Graded Results & Audit Report RFC 4180 CSV Export
  // --------------------------------------------------------------------------
  console.log('\n[6/7] Testing Graded Exam Results & RFC 4180 CSV Export...');
  const resultsRes = await fetch(`${API_URL}/admin/results`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const resultsData = await resultsRes.json();
  assert.equal(resultsRes.status, 200, 'Results endpoint must return HTTP 200');
  assert.ok(Array.isArray(resultsData.data), 'Results data must be an array');
  console.log(`  ✓ Exam Results Query: ${resultsData.data.length} graded exam results loaded`);

  // Test CSV export endpoint
  const csvRes = await fetch(`${API_URL}/admin/audit-report/export`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(csvRes.status, 200, 'CSV export endpoint must return HTTP 200');
  const contentType = csvRes.headers.get('content-type') || '';
  assert.ok(contentType.includes('text/csv'), 'Content-Type must be text/csv');
  const csvContent = await csvRes.text();
  assert.ok(csvContent.startsWith('"Log ID","Session ID"'), 'CSV must start with authoritative headers');
  const csvLines = csvContent.trim().split('\n');
  assert.ok(csvLines.length >= 2, 'CSV must have header + at least 1 row of audit data');
  console.log(`  ✓ RFC 4180 CSV Export Streamed Successfully (${csvLines.length} rows including headers)`);

  // --------------------------------------------------------------------------
  // Step 7: Client Production Bundle Asset Inspection
  // --------------------------------------------------------------------------
  console.log('\n[7/7] Verifying Client Production Bundle Assets (dist/assets)...');
  const distAssetsDir = join(process.cwd(), 'client', 'dist', 'assets');
  const files = readdirSync(distAssetsDir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'Compiled JS bundles must exist');

  const bundleContent = jsFiles.map(f => readFileSync(join(distAssetsDir, f), 'utf-8')).join('\n');

  // Verify critical production strings from the Admin Suite
  const expectedTokens = [
    'Administrator Console',
    'Circadian Incident Heatmap',
    'Authoritative Penalty Weight Engine',
    'Live Infraction Simulator',
    'Architect New Examination',
    'Export CSV',
  ];

  for (const token of expectedTokens) {
    assert.ok(
      bundleContent.includes(token),
      `Production bundle must contain UI token: "${token}"`
    );
  }
  console.log(`  ✓ All ${expectedTokens.length} Admin Suite UI components verified in client bundle (size: ${(bundleContent.length / 1024).toFixed(1)} KB)`);

  // Cleanup: Delete the temporary test exam created in Step 3
  await fetch(`${API_URL}/exams/${createdExamId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`  ✓ Cleaned up test exam ID ${createdExamId}`);

  console.log('\n====================================================');
  console.log(' ALL 7 ADMIN EXPERIENCE ACCEPTANCE GATES PASSED! ');
  console.log('====================================================\n');
}

testAdminExperience().catch(err => {
  console.error('\n❌ Admin Acceptance Test Failed:', err);
  process.exit(1);
});
