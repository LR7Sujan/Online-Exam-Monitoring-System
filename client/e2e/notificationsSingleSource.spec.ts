import { test, expect } from '@playwright/test';

test.describe('Phase 20: Notifications Single Source of Truth', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Google telemetry to avoid external 403s
    await page.route('**odml.pa.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('Single source of truth: bell badge, sidebar badge, panel unread items, and persistent clear', async ({
    page,
    request,
    browser,
  }) => {
    // 1. Create a student session in the test environment
    const studentEmail = `notif.student.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Notification Test Student',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const regJson = await regRes.json();
    const studentToken = regJson.data?.token;
    const studentId = regJson.data?.user?.id;

    // Create session for student
    const sessionRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { examId: 1 },
    });
    expect(sessionRes.ok()).toBeTruthy();
    const sessionJson = await sessionRes.json();
    const sessionId = sessionJson.data?.id ?? sessionJson.data?.session?.id;
    expect(sessionId).toBeGreaterThan(0);

    // 2. Proctor logs in
    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await page.goto('/proctor');

    // Clean baseline: clear all existing proctor notifications via API
    const proctorAuthRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const proctorToken = (await proctorAuthRes.json()).data?.token;
    await request.delete('http://localhost:4001/api/notifications', {
      headers: { Authorization: `Bearer ${proctorToken}` },
    });

    // Reload proctor page to ensure clean 0 state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert baseline: bell badge is not present (or 0)
    const bellBadge = page.locator('[data-testid="notification-bell-badge"]');
    await expect(bellBadge).not.toBeVisible();

    // 3. Trigger 1 Violation (NO_FACE: 10 pts)
    const vio1Res = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        code: 'NO_FACE',
      },
    });
    expect((await vio1Res.json()).success).toBe(true);

    // 4. Assert bell badge becomes 1
    await expect(bellBadge).toBeVisible({ timeout: 10000 });
    await expect(bellBadge).toHaveText('1');

    // Assert sidebar Live Monitor badge also matches 1
    const sidebarBadge = page.locator('[data-testid="nav-badge-proctor"]');
    await expect(sidebarBadge).toBeVisible({ timeout: 5000 });
    await expect(sidebarBadge).toHaveText('1');

    // 5. Open notification panel
    const bellBtn = page.locator('[data-testid="notification-bell-btn"]');
    await bellBtn.click();

    const panel = page.locator('[data-testid="notification-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Assert panel header shows 1 Active
    await expect(page.locator('[data-testid="notification-panel-unread-chip"]')).toHaveText('1 Active');

    // Assert notification message is readable and contains student name and penalty
    const notifItem = panel.locator('[data-testid^="notification-item-"]').first();
    await expect(notifItem).toBeVisible();
    await expect(notifItem.locator('[data-testid="notification-unread-dot"]')).toBeVisible();

    const notifMsg = notifItem.locator('[data-testid="notification-message"]');
    await expect(notifMsg).toContainText('Notification Test Student');
    await expect(notifMsg).toContainText('-20 pts');

    await page.screenshot({ path: 'docs/phase20-screenshots/notification-panel-unread-dark.png' });

    // 6. Click item -> marks read, badge becomes 0
    await notifItem.click();
    await page.waitForTimeout(300);

    // Bell badge must now be gone (0 unread)
    await expect(bellBadge).not.toBeVisible({ timeout: 5000 });

    // 7. Register a second student to test multi-student alert aggregation without grace collisions
    const student2Email = `notif.student2.${Date.now()}@proctoriq.io`;
    const reg2Res = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Second Examinee',
        email: student2Email,
        password: 'ProctorIQ#2026',
      },
    });
    const student2Token = (await reg2Res.json()).data?.token;

    const session2Res = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${student2Token}` },
      data: { examId: 1 },
    });
    const session2Id = (await session2Res.json()).data?.id;

    // Trigger violation on student 2
    const vio2Res = await request.post(`http://localhost:4001/api/sessions/${session2Id}/violation`, {
      headers: { Authorization: `Bearer ${student2Token}` },
      data: { code: 'PHONE_DETECTED' },
    });
    expect((await vio2Res.json()).success).toBe(true);

    // Register a third student or session for the second new alert
    const student3Email = `notif.student3.${Date.now()}@proctoriq.io`;
    const reg3Res = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Third Examinee',
        email: student3Email,
        password: 'ProctorIQ#2026',
      },
    });
    const student3Token = (await reg3Res.json()).data?.token;

    const session3Res = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${student3Token}` },
      data: { examId: 1 },
    });
    const session3Id = (await session3Res.json()).data?.id;

    const vio3Res = await request.post(`http://localhost:4001/api/sessions/${session3Id}/violation`, {
      headers: { Authorization: `Bearer ${student3Token}` },
      data: { code: 'MULTIPLE_FACES' },
    });
    expect((await vio3Res.json()).success).toBe(true);

    // Assert badge becomes 2
    await expect(bellBadge).toBeVisible({ timeout: 10000 });
    await expect(bellBadge).toHaveText('2');

    // 8. Open panel -> Clear all (with confirm)
    await bellBtn.click();
    await expect(panel).toBeVisible({ timeout: 5000 });

    const clearAllBtn = panel.locator('[data-testid="notification-clear-all-btn"]');
    await expect(clearAllBtn).toBeVisible();
    await clearAllBtn.click();

    const confirmClearBtn = panel.locator('[data-testid="notification-confirm-clear-btn"]');
    await expect(confirmClearBtn).toBeVisible();
    await confirmClearBtn.click();

    // Assert panel immediately shows All Clear
    await expect(panel.locator('[data-testid="notification-empty-state"]')).toBeVisible({ timeout: 5000 });
    await expect(panel.locator('text=All Clear')).toBeVisible();

    await page.screenshot({ path: 'docs/phase20-screenshots/notification-panel-empty-dark.png' });

    // Assert badge is immediately 0
    await expect(bellBadge).not.toBeVisible();

    // 9. Reload page -> badge stays 0 and panel stays empty
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(bellBadge).not.toBeVisible();

    // Open panel after reload to verify persistent 0 state
    await bellBtn.click();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel.locator('text=All Clear')).toBeVisible();
    await expect(panel.locator('[data-testid^="notification-item-"]')).toHaveCount(0);

    // 10. Student role verification
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await studentPage.goto('/login');
    await studentPage.fill('input[type="email"]', studentEmail);
    await studentPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await studentPage.click('button:has-text("Authenticate & Enter Console")');
    await studentPage.waitForURL(/\/student|\/home/, { timeout: 15000 });

    // Trigger violation for student warning notification
    await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { code: 'NO_FACE' },
    });

    const studentBell = studentPage.locator('[data-testid="notification-bell-btn"]');
    await expect(studentBell).toBeVisible({ timeout: 5000 });

    const studentBellBadge = studentPage.locator('[data-testid="notification-bell-badge"]');
    await expect(studentBellBadge).toBeVisible({ timeout: 10000 });

    await studentBell.click();
    const studentPanel = studentPage.locator('[data-testid="notification-panel"]');
    await expect(studentPanel).toBeVisible({ timeout: 5000 });
    await expect(studentPanel.locator('text=Activity Notifications')).toBeVisible();
    await studentPage.waitForTimeout(300);

    await studentPage.screenshot({ path: 'docs/phase20-screenshots/notification-panel-student-dark.png' });

    await studentContext.close();
  });
});
