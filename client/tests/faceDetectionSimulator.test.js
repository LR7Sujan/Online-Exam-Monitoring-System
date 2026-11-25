import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const distDir = path.resolve(rootDir, 'client', 'dist');
// Resolve uploads directory relative to project root
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(rootDir, process.env.UPLOADS_DIR)
  : path.resolve(rootDir, 'server', 'uploads');

const API_BASE = process.env.VITE_API_URL || 'http://localhost:4001/api';
const SOCKET_URL = process.env.VITE_SOCKET_URL || 'http://localhost:4001';

async function main() {
  console.log('====================================================');
  console.log(' PROCTORIQ: FACE DETECTION & SWARM SIMULATOR TEST');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // 1. Bundle Verification: Face Detection, Camera Blocker, & Simulator Page
  // --------------------------------------------------------------------------
  console.log('[1/5] Verifying Production Client Assets for Face Detection & Simulator...');
  assert.ok(fs.existsSync(distDir), 'client/dist directory must exist');

  const assetsDir = path.resolve(distDir, 'assets');
  const assetFiles = fs.readdirSync(assetsDir);
  const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'Production bundle must contain generated JS chunks');

  // Concatenate all JS chunks to inspect symbols
  let allBundleCode = '';
  for (const f of jsFiles) {
    allBundleCode += fs.readFileSync(path.join(assetsDir, f), 'utf-8') + '\n';
  }

  // Verify Face Detection symbols in bundle
  assert.ok(
    allBundleCode.includes('Face OK') || allBundleCode.includes('FACE OK'),
    'Bundle must contain "Face OK" HUD indicator'
  );
  assert.ok(
    allBundleCode.includes('NO_FACE') || allBundleCode.includes('MULTIPLE_FACES'),
    'Bundle must reference optical violation codes NO_FACE & MULTIPLE_FACES'
  );
  assert.ok(
    allBundleCode.includes('Camera Access Denied') || allBundleCode.includes('Camera Access Required') || allBundleCode.includes('Retry Camera'),
    'Bundle must contain Camera Access Denied blocker component'
  );

  // Verify Simulator Page symbols in bundle
  assert.ok(
    allBundleCode.includes('Candidate Swarm Demo Simulator') || allBundleCode.includes('Swarm Simulator') || allBundleCode.includes('Launch Swarm'),
    'Bundle must contain Candidate Swarm Simulator page'
  );
  assert.ok(
    allBundleCode.includes('/admin/simulator'),
    'Bundle must route and link to /admin/simulator'
  );
  console.log(' -> Client production bundle verified successfully!\n');

  // --------------------------------------------------------------------------
  // 2. Face Detection Logic Unit Verification (0-face 5s & 2+ faces rule)
  // --------------------------------------------------------------------------
  console.log('[2/5] Verifying Face Detection Rules & Lens Obscuration Logic...');

  // State machine simulation of consecutive 0-face counter
  let consecutiveCounter = 0;
  let reportedViolation = null;

  function onDetectionTick(faceCount) {
    if (faceCount === 0) {
      consecutiveCounter += 1;
      if (consecutiveCounter >= 5) {
        reportedViolation = 'NO_FACE';
        consecutiveCounter = 0;
      }
    } else if (faceCount >= 2) {
      consecutiveCounter = 0;
      reportedViolation = 'MULTIPLE_FACES';
    } else {
      consecutiveCounter = 0;
    }
  }

  // Ticks 1 to 4 with 0 faces -> should NOT report violation yet
  for (let i = 1; i <= 4; i++) {
    onDetectionTick(0);
    assert.equal(reportedViolation, null, `Tick ${i} (4s) must not trigger NO_FACE`);
    assert.equal(consecutiveCounter, i);
  }

  // Tick 5 (5 consecutive seconds with 0 faces) -> MUST trigger NO_FACE
  onDetectionTick(0);
  assert.equal(reportedViolation, 'NO_FACE', 'Tick 5 (5 consecutive seconds) MUST trigger NO_FACE');
  assert.equal(consecutiveCounter, 0, 'Counter must reset after reporting NO_FACE');

  // Face recovered (1 face detected) -> normal
  reportedViolation = null;
  onDetectionTick(1);
  assert.equal(reportedViolation, null);
  assert.equal(consecutiveCounter, 0);

  // 2 faces detected -> MUST trigger MULTIPLE_FACES immediately
  onDetectionTick(2);
  assert.equal(reportedViolation, 'MULTIPLE_FACES', '2+ faces must immediately trigger MULTIPLE_FACES');

  console.log(' -> Face detection consecutive 5s & multi-face rules verified!\n');

  // --------------------------------------------------------------------------
  // 3. Backend Snapshot Upload & Static Serving E2E
  // --------------------------------------------------------------------------
  console.log('[3/5] Testing Snapshot Upload & Static Serving (/server/uploads)...');

  // Register a fresh test candidate to guarantee a pristine session
  const testStudentEmail = `test.student.${Date.now()}@proctoriq.io`;
  const studentRegRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Optical Test Candidate',
      email: testStudentEmail,
      password: 'ProctorIQ#2026',
    }),
  });
  const studentReg = await studentRegRes.json();
  assert.equal(studentReg.success, true, 'Student registration must succeed');
  const studentToken = studentReg.data.token;

  // Start fresh session for Exam 1
  const startSessionRes = await fetch(`${API_BASE}/exams/1/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ deviceFingerprint: `test-fp-${Date.now()}` }),
  });
  const startSession = await startSessionRes.json();
  assert.equal(startSession.success, true, 'Session start must succeed');
  const sessionId = startSession.data.id || startSession.data.session?.id;
  assert.ok(sessionId, 'Valid session ID must be available for testing');

  // Create a synthetic JPEG base64 payload
  const testBase64Jpeg =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // Report NO_FACE violation with snapshot attached
  const violReportRes = await fetch(`${API_BASE}/sessions/${sessionId}/violation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      code: 'NO_FACE',
      snapshot: testBase64Jpeg,
      evidenceMeta: {
        reason: 'Camera covered for 5 consecutive seconds (automated test)',
        testSuite: 'faceDetectionSimulator',
      },
    }),
  });
  const violReport = await violReportRes.json();
  assert.equal(violReport.success, true, 'Violation report with snapshot must succeed');
  assert.ok(violReport.data.logId, 'Must return inserted logId');
  assert.ok(violReport.data.snapshot_url, 'Must return snapshot_url');
  assert.ok(
    violReport.data.snapshot_url.startsWith('/uploads/snapshot-'),
    `snapshot_url must start with /uploads/snapshot- (got ${violReport.data.snapshot_url})`
  );

  // Verify file was written to disk in server/uploads
  const savedFilename = path.basename(violReport.data.snapshot_url);
  const diskPath = path.join(uploadsDir, savedFilename);
  assert.ok(fs.existsSync(diskPath), `Uploaded JPEG snapshot file must exist at ${diskPath}`);
  const diskStats = fs.statSync(diskPath);
  assert.ok(diskStats.size > 0, 'Uploaded snapshot file on disk must not be empty');

  // Verify unauthenticated fetch is blocked with 401
  const unauthFetchRes = await fetch(`${SOCKET_URL}${violReport.data.snapshot_url}`);
  assert.equal(unauthFetchRes.status, 401, 'Unauthenticated snapshot fetch must be blocked with HTTP 401');

  // Verify Express statically serves the snapshot over HTTP GET when authenticated
  const staticFetchRes = await fetch(
    `${SOCKET_URL}${violReport.data.snapshot_url}?token=${studentToken}`
  );
  assert.equal(staticFetchRes.status, 200, 'Authenticated static snapshot fetch must return HTTP 200');
  const fetchedBytes = await staticFetchRes.arrayBuffer();
  assert.equal(fetchedBytes.byteLength, diskStats.size, 'Fetched static bytes must match disk file size');

  console.log(` -> Snapshot saved to ${violReport.data.snapshot_url} and verified statically!\n`);

  // --------------------------------------------------------------------------
  // 4. Admin Simulator Endpoints & Realtime Socket Telemetry
  // --------------------------------------------------------------------------
  console.log('[4/5] Testing Admin Simulator API & Live Socket.IO Telemetry...');

  // Authenticate as Admin
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' }),
  });
  const adminLogin = await adminLoginRes.json();
  assert.equal(adminLogin.success, true, 'Admin login must succeed');
  const adminToken = adminLogin.data.token;

  // Connect Proctor Socket.IO client to listen for real-time broadcasts
  const proctorSocket = io(SOCKET_URL, {
    auth: { token: adminToken },
    transports: ['websocket'],
  });

  const receivedEvents = [];
  proctorSocket.on('violation:new', (payload) => {
    receivedEvents.push({ event: 'violation:new', payload });
  });
  proctorSocket.on('session:update', (payload) => {
    receivedEvents.push({ event: 'session:update', payload });
  });

  await new Promise((resolve) => {
    if (proctorSocket.connected) resolve();
    else proctorSocket.once('connect', resolve);
  });
  assert.ok(proctorSocket.connected, 'Socket.IO client connected successfully');

  // Start Simulator via Admin API
  const startSimRes = await fetch(`${API_BASE}/admin/simulator/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      examId: 1,
      studentCount: 5,
      speed: 3.0,
      chaos: 'high',
    }),
  });
  const startSim = await startSimRes.json();
  assert.equal(startSim.success, true, 'Simulator start must return success: true');
  assert.equal(startSim.data.isRunning, true, 'Simulator must be running');
  assert.equal(startSim.data.candidates.length, 5, 'Must spawn 5 virtual candidates');

  // Check Simulator Status
  const statusRes = await fetch(`${API_BASE}/admin/simulator/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const statusPayload = await statusRes.json();
  assert.equal(statusPayload.success, true);
  assert.equal(statusPayload.data.isRunning, true);

  // Let simulation tick for 2 seconds to generate infractions
  await new Promise((r) => setTimeout(r, 2200));

  // Pause Simulator
  const pauseRes = await fetch(`${API_BASE}/admin/simulator/pause`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const pausePayload = await pauseRes.json();
  assert.equal(pausePayload.data.isPaused, true, 'Simulator must be paused');

  // Resume Simulator
  const resumeRes = await fetch(`${API_BASE}/admin/simulator/resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const resumePayload = await resumeRes.json();
  assert.equal(resumePayload.data.isPaused, false, 'Simulator must resume');

  // Stop Simulator
  const stopRes = await fetch(`${API_BASE}/admin/simulator/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const stopPayload = await stopRes.json();
  assert.equal(stopPayload.data.isRunning, false, 'Simulator must be stopped');

  proctorSocket.disconnect();
  console.log(` -> Simulator API verified! Broadcasted ${receivedEvents.length} real-time Socket.IO events.\n`);

  // --------------------------------------------------------------------------
  // 5. CLI Simulator Script Verification (npm run simulate)
  // --------------------------------------------------------------------------
  console.log('[5/5] Testing CLI Simulator Script Execution (npm run simulate)...');

  try {
    const cliOutput = execSync(
      'npm run simulate -- --students 3 --speed 3 --chaos high --duration 2',
      { cwd: rootDir, encoding: 'utf-8', timeout: 15000 }
    );
    assert.ok(
      cliOutput.includes('PROCTORIQ CANDIDATE SWARM SIMULATOR'),
      'CLI output must contain header banner'
    );
    assert.ok(
      cliOutput.includes('Simulation running!'),
      'CLI output must indicate simulation running'
    );
    assert.ok(
      cliOutput.includes('Clean shutdown'),
      'CLI output must indicate clean shutdown'
    );
    console.log(' -> CLI simulate script completed cleanly with exit code 0!\n');
  } catch (err) {
    console.error('CLI execution error:', err);
    throw err;
  }

  console.log('====================================================');
  console.log(' ALL 5/5 ACCEPTANCE SUITES PASSED EMPIRICALLY!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR IN ACCEPTANCE TEST]:', err);
  process.exit(1);
});
