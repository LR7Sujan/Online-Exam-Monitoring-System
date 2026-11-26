import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';

test.describe('Student Message Box E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Google telemetry to avoid external 403s
    await page.route('**odml.pa.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('Student messages panel: friendly wording, unread badge, mark-all-read and clear persistence, and 403 isolation', async ({
    page,
    request,
  }) => {
    // 1. Register student 1
    const ts = Date.now();
    const student1Email = `student.msg1.${ts}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Aarav Messages',
        email: student1Email,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const student1Data = (await regRes.json()).data;
    const student1Token = student1Data.token;
    const student1Id = student1Data.user.id;

    // Start session on exam 1 (CS-101)
    const sessionRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${student1Token}` },
      data: { examId: 1 },
    });
    expect(sessionRes.ok()).toBeTruthy();
    const sessionId = (await sessionRes.json()).data.id;
    expect(sessionId).toBeGreaterThan(0);

    // 2. Trigger a warning (PHONE_DETECTED: 25 pts)
    const vioRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${student1Token}` },
      data: {
        code: 'PHONE_DETECTED',
      },
    });
    expect(vioRes.ok()).toBeTruthy();

    // 3. Make session eligible for extension (<10 mins), request extension and approve it via proctor
    const rootDir = process.cwd().endsWith('client') ? path.resolve(process.cwd(), '..') : process.cwd();
    execSync(
      `node -e "const mysql = require('./server/node_modules/mysql2'); const conn = mysql.createConnection({host:'127.0.0.1',user:'root',password:'proctoriq_root',database:'exam_monitoring_test'}); conn.query('UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ${sessionId}', () => conn.end());"`,
      { cwd: rootDir }
    );

    const extRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/extension`, {
      headers: { Authorization: `Bearer ${student1Token}` },
      data: {
        requestedMinutes: 10,
        reason: 'Network reconnection recovery',
      },
    });
    expect(extRes.ok()).toBeTruthy();
    const requestId = (await extRes.json()).data.requestId;

    // Login proctor to approve extension
    const proctorAuth = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const proctorToken = (await proctorAuth.json()).data.token;

    const decideRes = await request.post(`http://localhost:4001/api/extensions/${requestId}/decide`, {
      headers: { Authorization: `Bearer ${proctorToken}` },
      data: {
        decision: 'APPROVED',
        grantedMinutes: 10,
      },
    });
    expect(decideRes.ok()).toBeTruthy();

    // 4. Student logs in to web client
    await page.goto('/login');
    await page.fill('input[type="email"]', student1Email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student');
    await page.waitForLoadState('networkidle');

    // 5. Assert bell badge shows 2 unread messages
    const bellBadge = page.locator('[data-testid="notification-bell-badge"]');
    await expect(bellBadge).toBeVisible({ timeout: 10000 });
    await expect(bellBadge).toHaveText('2');

    // 6. Open bell -> StudentMessages panel opens
    const bellBtn = page.locator('[data-testid="notification-bell-btn"]');
    await bellBtn.click();

    const studentPanel = page.locator('[data-testid="student-messages-panel"]');
    await expect(studentPanel).toBeVisible({ timeout: 5000 });

    // Assert title is "Messages"
    await expect(studentPanel).toContainText('Messages');

    // Assert NO severity tabs (Critical, High, Med/Low) and NO "Candidate Audit Stream"
    await expect(studentPanel.locator('text=Critical')).toHaveCount(0);
    await expect(studentPanel.locator('text=Med/Low')).toHaveCount(0);
    await expect(studentPanel.locator('text=Candidate Audit Stream')).toHaveCount(0);

    // Assert unread chip displays "2 unread"
    const unreadChip = page.locator('[data-testid="student-messages-unread-chip"]');
    await expect(unreadChip).toBeVisible();
    await expect(unreadChip).toHaveText('2 unread');

    // Take screenshot evidence in dark mode
    await page.screenshot({
      path: 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9/student-messages-dark.png',
      fullPage: false,
    });

    // Switch to light mode and take screenshot evidence
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9/student-messages-light.png',
      fullPage: false,
    });
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(200);

    // Assert friendly plain-language wording:
    // Warning item:
    await expect(studentPanel).toContainText('A warning was issued during');
    await expect(studentPanel).toContainText('mobile phone');
    await expect(studentPanel).toContainText('-25 points');

    // Extra time item:
    await expect(studentPanel).toContainText('Your request for 10 extra minutes was approved');

    // 7. Test "Mark all as read"
    const markAllBtn = page.locator('[data-testid="student-messages-mark-all-btn"]');
    await expect(markAllBtn).toBeVisible();
    await markAllBtn.click();

    // Unread chip should disappear
    await expect(unreadChip).not.toBeVisible();
    // Unread dots should disappear
    await expect(page.locator('[data-testid="unread-dot"]')).toHaveCount(0);
    // Bell badge disappears
    await expect(bellBadge).not.toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="notification-bell-badge"]')).not.toBeVisible();

    // Open panel again
    await page.locator('[data-testid="notification-bell-btn"]').click();
    await expect(studentPanel).toBeVisible();
    await expect(page.locator('[data-testid="student-messages-unread-chip"]')).not.toBeVisible();

    // 8. Test "Clear" action with confirm
    const clearBtn = page.locator('[data-testid="student-messages-clear-btn"]');
    await clearBtn.click();

    const confirmClearBtn = page.locator('[data-testid="confirm-clear-messages-btn"]');
    await expect(confirmClearBtn).toBeVisible();
    await confirmClearBtn.click();

    // Empty state should be visible
    const emptyState = page.locator('[data-testid="student-messages-empty"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('You have no messages yet.');

    // Reload page to verify cleared persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="notification-bell-btn"]').click();
    await expect(emptyState).toBeVisible();

    // 9. SECURITY / IDOR CHECK: Student 1 cannot read Student 2's notifications (403)
    const student2Email = `student.msg2.${ts}@proctoriq.io`;
    const reg2Res = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Second Student',
        email: student2Email,
        password: 'ProctorIQ#2026',
      },
    });
    const student2Data = (await reg2Res.json()).data;
    const student2Token = student2Data.token;

    // Start session and create a notification for student 2
    const s2SessionRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${student2Token}` },
      data: { examId: 1 },
    });
    const s2SessionId = (await s2SessionRes.json()).data.id;

    await request.post(`http://localhost:4001/api/sessions/${s2SessionId}/violation`, {
      headers: { Authorization: `Bearer ${student2Token}` },
      data: { code: 'DEVTOOLS_OPEN' },
    });

    // Get student 2's notification ID
    const s2NotifsRes = await request.get('http://localhost:4001/api/notifications', {
      headers: { Authorization: `Bearer ${student2Token}` },
    });
    const s2Notifs = (await s2NotifsRes.json()).data.notifications;
    expect(s2Notifs.length).toBeGreaterThan(0);
    const s2NotifId = s2Notifs[0].id;

    // Student 1 attempts to read Student 2's notification via GET
    const getOtherRes = await request.get(`http://localhost:4001/api/notifications/${s2NotifId}`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    expect(getOtherRes.status()).toBe(403);

    // Student 1 attempts to mark read Student 2's notification via POST
    const markOtherRes = await request.post(`http://localhost:4001/api/notifications/${s2NotifId}/read`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    expect(markOtherRes.status()).toBe(403);

    // 10. PROCTOR / ADMIN PANEL UNCHANGED CHECK:
    // Clear storage/cookies to log out student
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // When proctor logs in, bell still opens the admin-style "Violation Telemetry Feed"
    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await page.goto('/proctor');
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="notification-bell-btn"]').click();
    const proctorPanel = page.locator('[data-testid="notification-panel"]');
    await expect(proctorPanel).toBeVisible({ timeout: 5000 });
    await expect(proctorPanel).toContainText('Violation Telemetry Feed');
    // Proctor panel maintains severity tabs
    await expect(proctorPanel.locator('[data-testid="notif-tab-CRITICAL"]')).toBeVisible();
    await expect(proctorPanel.locator('[data-testid="notif-tab-MEDIUM_LOW"]')).toBeVisible();
  });
});
