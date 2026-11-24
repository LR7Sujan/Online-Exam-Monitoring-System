import { test, expect } from '@playwright/test';

test.describe('Phase 20: Live Monitor Live Sessions Only', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Google telemetry to avoid external 403s
    await page.route('**odml.pa.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('Live Monitor shows only IN_PROGRESS sessions, removes submitted/terminated sessions immediately, and shows empty state', async ({
    page,
    request,
  }) => {
    // 1. Proctor Login
    const proctorAuthRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    expect(proctorAuthRes.ok()).toBeTruthy();
    const proctorToken = (await proctorAuthRes.json()).data?.token;

    // 2. Verify API returns only IN_PROGRESS sessions
    const liveApiRes = await request.get('http://localhost:4001/api/monitor/live', {
      headers: { Authorization: `Bearer ${proctorToken}` },
    });
    expect(liveApiRes.ok()).toBeTruthy();
    const liveApiJson = await liveApiRes.json();
    const initialLiveSessions = liveApiJson.data ?? [];
    for (const s of initialLiveSessions) {
      expect(s.status).toBe('IN_PROGRESS');
    }

    // 3. Navigate proctor to /proctor
    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await page.goto('/proctor');
    await page.waitForLoadState('networkidle');

    // If there were any leftover test live sessions, clean them by submitting
    for (const s of initialLiveSessions) {
      await request.post(`http://localhost:4001/api/proctor/sessions/${s.session_id}/terminate`, {
        headers: { Authorization: `Bearer ${proctorToken}` },
        data: { reason: 'Test cleanup' },
      });
    }

    // Reload page to observe nominal zero-live-session state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 4. Verify Empty State when zero live sessions are running
    await expect(page.locator('text=No exams are running right now')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=All candidate assessments have concluded')).toBeVisible();
    const openAuditBtn = page.locator('button:has-text("Open Student Audit")');
    await expect(openAuditBtn).toBeVisible();

    // Verify filter dropdown wording
    await expect(page.locator('select[aria-label="Filter candidates by assessment"]')).toContainText('All Active Exams (0)');
    await expect(page.locator('select[aria-label="Filter candidates by session status"]')).toContainText('All live');
    await expect(page.locator('text=Showing 0 live candidates')).toBeVisible();

    // Visual screenshot of Live Monitor Empty State
    const fs = await import('node:fs');
    const path = await import('node:path');
    const rootDir = process.cwd().endsWith('client') ? path.resolve(process.cwd(), '..') : process.cwd();
    const outDir = path.resolve(rootDir, 'docs/phase20-screenshots');
    fs.mkdirSync(outDir, { recursive: true });

    await page.screenshot({ path: path.join(outDir, 'live-monitor-empty-dark.png'), fullPage: true });
    await page.evaluate(() => {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'live-monitor-empty-light.png'), fullPage: true });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    });
    await page.waitForTimeout(300);

    // 5. Register and start a live student session
    const studentEmail = `livemon.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Elena Rostova',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const studentToken = (await regRes.json()).data?.token;

    const startRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { examId: 1 },
    });
    expect(startRes.ok()).toBeTruthy();
    const sessionData = (await startRes.json()).data?.session ?? (await startRes.json()).data;
    const sessionId = sessionData.id;

    // 6. Assert live tile appears without page refresh (via socket session:started or polling)
    const studentTile = page.locator(`[data-testid="student-tile-${sessionId}"]`);
    await expect(studentTile).toBeVisible({ timeout: 10000 });

    // Verify exam filter updated to 1
    await expect(page.locator('select[aria-label="Filter candidates by assessment"]')).toContainText('All Active Exams (1)');
    await expect(page.locator('text=Showing 1 live candidates')).toBeVisible();

    await page.screenshot({ path: path.join(outDir, 'live-monitor-live-candidate-dark.png'), fullPage: true });

    // 7. Verify Heartbeat keeps session alive
    const hbRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/heartbeat`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(hbRes.ok()).toBeTruthy();
    const hbJson = await hbRes.json();
    expect(hbJson.success).toBe(true);

    // 8. Submit the exam
    const submitRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(submitRes.ok()).toBeTruthy();

    // 9. Assert tile disappears within 1s without page refresh
    await expect(studentTile).not.toBeVisible({ timeout: 5000 });

    // 10. Assert empty state returns immediately
    await expect(page.locator('text=No exams are running right now')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Showing 0 live candidates')).toBeVisible();

    // 11. Verify "Just finished" strip shows the candidate
    const justFinishedBtn = page.locator('button:has-text("Just finished")');
    await expect(justFinishedBtn).toBeVisible({ timeout: 5000 });

    // Expand just finished strip and verify candidate is listed
    await justFinishedBtn.click();
    await expect(page.locator('text=Elena Rostova')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Inspect →")')).toBeVisible({ timeout: 5000 });

    // 12. Start another session and test Terminate Flow
    const student2Email = `terminate.${Date.now()}@proctoriq.io`;
    const reg2Res = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Marcus Vance',
        email: student2Email,
        password: 'ProctorIQ#2026',
      },
    });
    const student2Token = (await reg2Res.json()).data?.token;

    const start2Res = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${student2Token}` },
      data: { examId: 1 },
    });
    const session2Id = (await start2Res.json()).data?.session?.id ?? (await start2Res.json()).data?.id;

    // Tile 2 appears
    const tile2 = page.locator(`[data-testid="student-tile-${session2Id}"]`);
    await expect(tile2).toBeVisible({ timeout: 10000 });

    // Terminate session via proctor action
    const termRes = await request.post(`http://localhost:4001/api/proctor/sessions/${session2Id}/terminate`, {
      headers: { Authorization: `Bearer ${proctorToken}` },
      data: { reason: 'Severe malpractice' },
    });
    expect(termRes.ok()).toBeTruthy();

    // Assert tile 2 disappears without reload
    await expect(tile2).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=No exams are running right now')).toBeVisible({ timeout: 5000 });

    // 13. Test Disconnected state: session with no heartbeat for >90s shows DISCONNECTED
    const student3Email = `disconnect.${Date.now()}@proctoriq.io`;
    const reg3Res = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Lucas Meyer',
        email: student3Email,
        password: 'ProctorIQ#2026',
      },
    });
    const student3Token = (await reg3Res.json()).data?.token;

    const start3Res = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${student3Token}` },
      data: { examId: 1 },
    });
    const session3Id = (await start3Res.json()).data?.session?.id ?? (await start3Res.json()).data?.id;

    // Simulate stale heartbeat (>90s) in test DB
    const { execSync } = await import('node:child_process');
    execSync(
      `node -e "const mysql = require('./server/node_modules/mysql2'); const conn = mysql.createConnection({host:'127.0.0.1',user:'root',password:'proctoriq_root',database:'exam_monitoring_test'}); conn.query('UPDATE Exam_Sessions SET last_seen_at = DATE_SUB(NOW(), INTERVAL 120 SECOND), last_heartbeat_at = DATE_SUB(NOW(), INTERVAL 120 SECOND) WHERE id = ${session3Id}', () => conn.end());"`,
      { cwd: process.cwd() }
    );

    // Reload proctor page to fetch fresh telemetry row from vw_LiveSessions
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Tile 3 must display the amber DISCONNECTED pill
    const tile3 = page.locator(`[data-testid="student-tile-${session3Id}"]`);
    await expect(tile3).toBeVisible({ timeout: 10000 });
    await expect(tile3.locator('text=DISCONNECTED')).toBeVisible();

    // Clean up session 3
    await request.post(`http://localhost:4001/api/proctor/sessions/${session3Id}/terminate`, {
      headers: { Authorization: `Bearer ${proctorToken}` },
      data: { reason: 'Test complete' },
    });
    await expect(tile3).not.toBeVisible({ timeout: 5000 });
  });
});
