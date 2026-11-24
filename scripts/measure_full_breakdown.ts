import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  console.log('=== PROCTORIQ STEP 1: PERFORMANCE MEASUREMENT & BREAKDOWN ===\n');

  const browser = await chromium.launch({ headless: true });

  // 1. Measure Student-side Detectors & Encoding Latency
  console.log('[1. Student Side Baseline Profiling]');
  const studentContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const studentPage = await studentContext.newPage();
  await studentPage.goto('http://localhost:5174');

  const clientEval = await studentPage.evaluate(async () => {
    // Generate synthetic camera frame at 640x480 and 320x240
    const canvas640 = document.createElement('canvas');
    canvas640.width = 640;
    canvas640.height = 480;
    const ctx640 = canvas640.getContext('2d')!;
    ctx640.fillStyle = '#1e293b';
    ctx640.fillRect(0, 0, 640, 480);
    ctx640.fillStyle = '#38bdf8';
    ctx640.font = '24px sans-serif';
    ctx640.fillText('Simulated Candidate Frame', 50, 50);

    const canvas320 = document.createElement('canvas');
    canvas320.width = 320;
    canvas320.height = 240;
    const ctx320 = canvas320.getContext('2d')!;
    ctx320.drawImage(canvas640, 0, 0, 320, 240);

    // Measure toDataURL 640x480 (Full resolution)
    const times640: number[] = [];
    let b64Size640 = 0;
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      const b64 = canvas640.toDataURL('image/jpeg', 0.7);
      const t1 = performance.now();
      times640.push(t1 - t0);
      b64Size640 = b64.length;
    }
    times640.sort((a, b) => a - b);

    // Measure toDataURL 320x240 (Downscaled)
    const times320: number[] = [];
    let b64Size320 = 0;
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      const b64 = canvas320.toDataURL('image/jpeg', 0.7);
      const t1 = performance.now();
      times320.push(t1 - t0);
      b64Size320 = b64.length;
    }
    times320.sort((a, b) => a - b);

    // Measure createImageBitmap transfer cost
    const bitmapTimes: number[] = [];
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      const bmp = await createImageBitmap(canvas640, 0, 0, 640, 480, {
        resizeWidth: 320,
        resizeHeight: 240,
      });
      const t1 = performance.now();
      bitmapTimes.push(t1 - t0);
      bmp.close();
    }
    bitmapTimes.sort((a, b) => a - b);

    return {
      encode640_p50: times640[Math.floor(times640.length * 0.5)],
      encode640_p95: times640[Math.floor(times640.length * 0.95)],
      size640_bytes: b64Size640,
      encode320_p50: times320[Math.floor(times320.length * 0.5)],
      encode320_p95: times320[Math.floor(times320.length * 0.95)],
      size320_bytes: b64Size320,
      bitmapResize_p50: bitmapTimes[Math.floor(bitmapTimes.length * 0.5)],
      bitmapResize_p95: bitmapTimes[Math.floor(bitmapTimes.length * 0.95)],
    };
  });

  console.log(`• 640x480 JPEG Encode (Main Thread): p50 = ${clientEval.encode640_p50.toFixed(2)}ms, p95 = ${clientEval.encode640_p95.toFixed(2)}ms (Size: ${(clientEval.size640_bytes / 1024).toFixed(1)} KB)`);
  console.log(`• 320x240 JPEG Encode: p50 = ${clientEval.encode320_p50.toFixed(2)}ms, p95 = ${clientEval.encode320_p95.toFixed(2)}ms (Size: ${(clientEval.size320_bytes / 1024).toFixed(1)} KB)`);
  console.log(`• createImageBitmap (with hardware resize to 320x240): p50 = ${clientEval.bitmapResize_p50.toFixed(2)}ms, p95 = ${clientEval.bitmapResize_p95.toFixed(2)}ms`);

  // 2. Measure Server Endpoint Latency with 3 student sessions
  console.log('\n[2. Server Violation Endpoint Baseline Profiling]');
  const studentTokens: string[] = [];
  const sessionIds: number[] = [];

  for (let s = 1; s <= 3; s++) {
    const regRes = await fetch('http://localhost:4001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Perf Student ${s}`,
        email: `perf.student.${s}.${Date.now()}@proctoriq.io`,
        password: 'ProctorIQ#2026',
      }),
    });
    const regData = await regRes.json();
    const token = regData.data.token;
    studentTokens.push(token);

    const startRes = await fetch('http://localhost:4001/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ examId: 1 }),
    });
    const startData = await startRes.json();
    const sid = startData.data?.session?.id ?? startData.data?.id;
    sessionIds.push(sid);
  }

  const sampleSnapshotB64 = 'data:image/jpeg;base64,' + 'B'.repeat(clientEval.size640_bytes);

  // Measure latency with full snapshot upload
  const withSnapshotLatencies: number[] = [];
  const withoutSnapshotLatencies: number[] = [];

  // 15 runs per student (ack after each warning to simulate real flow)
  for (let i = 0; i < 15; i++) {
    const sIdx = i % 3;
    const sid = sessionIds[sIdx];
    const tok = studentTokens[sIdx];

    const t0 = performance.now();
    const vRes = await fetch(`http://localhost:4001/api/sessions/${sid}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        code: 'LOOKING_AWAY',
        snapshot: sampleSnapshotB64,
        evidenceMeta: { iter: i },
      }),
    });
    const vData = await vRes.json();
    const t1 = performance.now();
    withSnapshotLatencies.push(t1 - t0);

    // Acknowledge warning so next violation is processed
    if (vData.data?.warning?.warningId) {
      await fetch(`http://localhost:4001/api/sessions/${sid}/warnings/${vData.data.warning.warningId}/ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
      });
    }
  }

  // Measure latency without snapshot (code + meta only)
  for (let i = 0; i < 15; i++) {
    const sIdx = i % 3;
    const sid = sessionIds[sIdx];
    const tok = studentTokens[sIdx];

    const t0 = performance.now();
    const vRes = await fetch(`http://localhost:4001/api/sessions/${sid}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        code: 'LOOKING_AWAY',
        evidenceMeta: { iter: i },
      }),
    });
    const vData = await vRes.json();
    const t1 = performance.now();
    withoutSnapshotLatencies.push(t1 - t0);

    if (vData.data?.warning?.warningId) {
      await fetch(`http://localhost:4001/api/sessions/${sid}/warnings/${vData.data.warning.warningId}/ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
      });
    }
  }

  withSnapshotLatencies.sort((a, b) => a - b);
  withoutSnapshotLatencies.sort((a, b) => a - b);

  const ws_p50 = withSnapshotLatencies[Math.floor(withSnapshotLatencies.length * 0.5)];
  const ws_p95 = withSnapshotLatencies[Math.floor(withSnapshotLatencies.length * 0.95)];
  const wos_p50 = withoutSnapshotLatencies[Math.floor(withoutSnapshotLatencies.length * 0.5)];
  const wos_p95 = withoutSnapshotLatencies[Math.floor(withoutSnapshotLatencies.length * 0.95)];

  console.log(`• Server POST /violation WITH 640x480 Snapshot: p50 = ${ws_p50.toFixed(1)}ms, p95 = ${ws_p95.toFixed(1)}ms`);
  console.log(`• Server POST /violation WITHOUT Snapshot:       p50 = ${wos_p50.toFixed(1)}ms, p95 = ${wos_p95.toFixed(1)}ms`);

  // 3. Measure Proctor Side Tile Update and Frame Rate
  console.log('\n[3. Proctor Side Baseline Profiling]');
  const proctorContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const proctorPage = await proctorContext.newPage();

  // Login proctor
  await proctorPage.goto('http://localhost:5174/login');
  await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
  await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
  await proctorPage.click('button:has-text("Authenticate & Enter Console")');
  await proctorPage.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
  await proctorPage.goto('http://localhost:5174/proctor');
  await proctorPage.waitForLoadState('networkidle');

  // Measure proctor RAF and tile update timing
  const proctorProfile = await proctorPage.evaluate(() => {
    return new Promise<{ avgFrameTimeMs: number; fps: number }>((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();
      let lastTime = startTime;
      const frameDeltas: number[] = [];

      function countFrame(now: number) {
        frameDeltas.push(now - lastTime);
        lastTime = now;
        frameCount++;
        if (frameCount < 60) {
          requestAnimationFrame(countFrame);
        } else {
          const totalDuration = now - startTime;
          const fps = (frameCount / totalDuration) * 1000;
          const avgDelta = totalDuration / frameCount;
          resolve({ avgFrameTimeMs: avgDelta, fps });
        }
      }
      requestAnimationFrame(countFrame);
    });
  });

  console.log(`• Proctor Dashboard Animation Frame Time: ${proctorProfile.avgFrameTimeMs.toFixed(2)}ms (${proctorProfile.fps.toFixed(1)} FPS)`);

  // Clean up
  for (const sid of sessionIds) {
    await fetch(`http://localhost:4001/api/proctor/sessions/${sid}/terminate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(await (await fetch('http://localhost:4001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' }),
        })).json()).data.token}`,
      },
      body: JSON.stringify({ reason: 'Bench complete' }),
    });
  }

  await browser.close();
  console.log('\n=== BASELINE MEASUREMENT COMPLETE ===');
}

main().catch(console.error);
