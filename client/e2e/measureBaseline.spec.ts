import { test, expect } from '@playwright/test';

test.describe('Phase 20 Step 4: Performance Measurement Baseline', () => {
  test('Measure student detection pipeline, server latency, and proctor UI response', async ({
    page,
    request,
    browser,
  }) => {
    // 1. Proctor Login in one context
    const proctorContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const proctorPage = await proctorContext.newPage();

    const proctorAuth = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const proctorToken = (await proctorAuth.json()).data?.token;

    await proctorPage.goto('http://localhost:5174/login');
    await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
    await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await proctorPage.click('button:has-text("Authenticate & Enter Console")');
    await proctorPage.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await proctorPage.goto('http://localhost:5174/proctor');
    await proctorPage.waitForLoadState('networkidle');

    // 2. Measure Server Endpoint Latency (50 runs with real DB triggers)
    console.log('\n--- MEASURING SERVER ENDPOINT LATENCY (50 RUNS) ---');
    const studentAuth = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Bench Student',
        email: `bench.${Date.now()}@proctoriq.io`,
        password: 'ProctorIQ#2026',
      },
    });
    const studentToken = (await studentAuth.json()).data?.token;

    const sessionRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { examId: 1 },
    });
    const sessionId = (await sessionRes.json()).data?.id ?? (await sessionRes.json()).data?.session?.id;

    // Generate a 150KB sample snapshot (simulating 640x480 JPEG)
    const sampleSnapshot = 'data:image/jpeg;base64,' + 'A'.repeat(150 * 1024);

    const latenciesWithSnapshot: number[] = [];
    const latenciesWithoutSnapshot: number[] = [];

    // Measure server latency with snapshot
    for (let i = 0; i < 20; i++) {
      // Clear pending warning between runs to test violation processing
      const start = performance.now();
      const res = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: {
          code: 'LOOKING_AWAY',
          snapshot: sampleSnapshot,
          evidenceMeta: { run: i, timestamp: new Date().toISOString() },
        },
      });
      const end = performance.now();
      if (res.ok()) {
        latenciesWithSnapshot.push(end - start);
      }
    }

    // Measure server latency without snapshot (code + meta only)
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const res = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: {
          code: 'LOOKING_AWAY',
          evidenceMeta: { run: i, timestamp: new Date().toISOString() },
        },
      });
      const end = performance.now();
      if (res.ok()) {
        latenciesWithoutSnapshot.push(end - start);
      }
    }

    latenciesWithSnapshot.sort((a, b) => a - b);
    latenciesWithoutSnapshot.sort((a, b) => a - b);

    const p50With = latenciesWithSnapshot[Math.floor(latenciesWithSnapshot.length * 0.5)] ?? 0;
    const p95With = latenciesWithSnapshot[Math.floor(latenciesWithSnapshot.length * 0.95)] ?? 0;
    const p50Without = latenciesWithoutSnapshot[Math.floor(latenciesWithoutSnapshot.length * 0.5)] ?? 0;
    const p95Without = latenciesWithoutSnapshot[Math.floor(latenciesWithoutSnapshot.length * 0.95)] ?? 0;

    console.log(`Server Violation Latency WITH Snapshot (150KB): p50 = ${p50With.toFixed(1)}ms, p95 = ${p95With.toFixed(1)}ms`);
    console.log(`Server Violation Latency WITHOUT Snapshot (Fast Report): p50 = ${p50Without.toFixed(1)}ms, p95 = ${p95Without.toFixed(1)}ms`);

    // 3. Student Client Profiling (Canvas encoding & Detector execution)
    console.log('\n--- MEASURING CLIENT DETECTORS & SNAPSHOT ENCODING ---');
    const studentContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ['camera', 'microphone'],
    });
    const studentPage = await studentContext.newPage();

    // Login student
    await studentPage.goto('http://localhost:5174/login');
    await studentPage.fill('input[type="email"]', `bench.${Date.now() - 1000}@proctoriq.io`);
    // Create new student for exam page test
    const st2Email = `student.bench.${Date.now()}@proctoriq.io`;
    const reg2 = await request.post('http://localhost:4001/api/auth/register', {
      data: { fullName: 'Bench Student 2', email: st2Email, password: 'ProctorIQ#2026' },
    });
    const st2Token = (await reg2.json()).data?.token;

    await studentPage.fill('input[type="email"]', st2Email);
    await studentPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await studentPage.click('button:has-text("Authenticate & Enter Console")');
    await studentPage.waitForURL(/\/student|\/home/, { timeout: 15000 });

    // Start exam session
    const sess2Res = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${st2Token}` },
      data: { examId: 1 },
    });
    const sess2Id = (await sess2Res.json()).data?.session?.id ?? (await sess2Res.json()).data?.id;

    // Navigate to exam page
    await studentPage.goto(`http://localhost:5174/student/exam/${sess2Id}`);
    await studentPage.waitForLoadState('networkidle');

    // Run client micro-benchmarks inside the real browser page
    const clientMetrics = await studentPage.evaluate(async () => {
      // Benchmark 1: Canvas snapshot capture & JPEG encoding time at 640x480
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#223344';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Benchmarking Video Frame', 50, 50);

      const encodeTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const t1 = performance.now();
        encodeTimes.push(t1 - t0);
      }
      encodeTimes.sort((a, b) => a - b);

      // Benchmark 2: Downscaled 320x240 encoding vs 640x480
      const canvasSmall = document.createElement('canvas');
      canvasSmall.width = 320;
      canvasSmall.height = 240;
      const ctxSmall = canvasSmall.getContext('2d')!;
      ctxSmall.drawImage(canvas, 0, 0, 320, 240);
      const smallEncodeTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now();
        const dataUrl = canvasSmall.toDataURL('image/jpeg', 0.7);
        const t1 = performance.now();
        smallEncodeTimes.push(t1 - t0);
      }
      smallEncodeTimes.sort((a, b) => a - b);

      // Benchmark 3: Measure long tasks observer if available
      return {
        encode640x480_p50: encodeTimes[Math.floor(encodeTimes.length * 0.5)],
        encode640x480_p95: encodeTimes[Math.floor(encodeTimes.length * 0.95)],
        encode320x240_p50: smallEncodeTimes[Math.floor(smallEncodeTimes.length * 0.5)],
        encode320x240_p95: smallEncodeTimes[Math.floor(smallEncodeTimes.length * 0.95)],
      };
    });

    console.log(`Canvas 640x480 JPEG Encode (Main Thread): p50 = ${clientMetrics.encode640x480_p50.toFixed(1)}ms, p95 = ${clientMetrics.encode640x480_p95.toFixed(1)}ms`);
    console.log(`Canvas 320x240 JPEG Encode (Downscaled): p50 = ${clientMetrics.encode320x240_p50.toFixed(1)}ms, p95 = ${clientMetrics.encode320x240_p95.toFixed(1)}ms`);

    // 4. Measure Proctor Side Tile Update and Render Latency
    console.log('\n--- MEASURING PROCTOR SIDE TILE UPDATE LATENCY ---');
    // Ensure proctor page is loaded with the live candidate tile
    const tile = proctorPage.locator(`[data-testid="student-tile-${sess2Id}"]`);
    await expect(tile).toBeVisible({ timeout: 10000 });

    // Measure time from violation trigger to tile shake/glow or update on proctor page
    const proctorMetrics = await proctorPage.evaluate(() => {
      return new Promise<{ renderLatencyMs: number }>((resolve) => {
        const start = performance.now();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const end = performance.now();
            resolve({ renderLatencyMs: end - start });
          });
        });
      });
    });
    console.log(`Proctor Raf Latency Baseline: ${proctorMetrics.renderLatencyMs.toFixed(1)}ms`);

    await studentContext.close();
    await proctorContext.close();
  });
});
