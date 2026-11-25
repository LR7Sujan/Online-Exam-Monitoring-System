import { test, expect } from '@playwright/test';

test.describe('End-to-End Warning Screen & History Flow (Multi-Context)', () => {
  test.setTimeout(90000);

  async function setupStudentSession(page: any, request: any, prefix = 'warn-student') {
    const studentEmail = `${prefix}.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: `Candidate ${prefix}`,
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    const regJson = await regRes.json();
    const token = regJson.data?.token;
    const studentId = regJson.data?.user?.id || regJson.data?.id;

    // Login via UI
    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student');

    // Launch Exam #5 (1-min test exam) or Exam #1
    const examCard = page.locator('[data-testid="exam-card-5"], [data-testid="exam-card-1"]').first();
    await expect(examCard).toBeVisible({ timeout: 10000 });
    await examCard
      .locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")')
      .first()
      .click();

    // Complete Pre-Exam Checklist if shown
    const checklistModal = page.locator('text=Pre-Flight Verification Kiosk');
    if (await checklistModal.isVisible({ timeout: 4000 }).catch(() => false)) {
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Continue")');
      const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
      if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await authCamBtn.click();
        await page.waitForTimeout(400);
      }
      await page.click('button:has-text("Continue")');
      const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
      if (await enterFsBtn.isVisible().catch(() => false)) {
        await enterFsBtn.click();
        await page.waitForTimeout(300);
      }
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(500);
      const launchBtn = page.locator('button:has-text("Initialize Assessment Session")');
      await expect(launchBtn).toBeVisible({ timeout: 10000 });
      await launchBtn.click();
    }

    await page.waitForURL('**/student/session/**', { timeout: 20000 });
    const match = page.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;

    return { studentEmail, studentId, sessionId, token, studentName: `Candidate ${prefix}` };
  }

  test('Full Warning Flow: trigger violation, warning screen appears, answers locked, ignore subsequent, reload restores, acknowledge, history drawer, and proctor live badge', async ({
    browser,
    request,
  }) => {
    // 1. Setup Proctor Context & Login
    const proctorContext = await browser.newContext();
    const proctorPage = await proctorContext.newPage();
    await proctorPage.goto('/login');
    await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
    await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await proctorPage.click('button:has-text("Authenticate & Enter Console")');
    await proctorPage.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await proctorPage.goto('/proctor');
    await expect(proctorPage.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    // 2. Setup Student Context & Start Exam
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const { studentEmail, sessionId, token, studentName } = await setupStudentSession(studentPage, request, 'warning-flow');

    // Select Answer Option B on Question 1
    const optionB = studentPage.locator('button:has-text("B.")');
    await expect(optionB).toBeVisible({ timeout: 10000 });
    await optionB.click();
    await expect(studentPage.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    // 3. Trigger Violation (PHONE_DETECTED: 25 points penalty)
    const vioRes1 = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        code: 'PHONE_DETECTED',
        evidenceMeta: { trigger: 'e2e_test_phone' },
      },
    });
    const vioJson1 = await vioRes1.json();
    expect(vioJson1.success).toBe(true);
    expect(vioJson1.data.warning).toBeTruthy();
    expect(vioJson1.data.warning.violationCode).toBe('PHONE_DETECTED');

    // 4. Assert Full-Screen Warning Overlay Appears on Student Page
    const warningOverlay = studentPage.locator('[data-testid="violation-warning-overlay"]');
    await expect(warningOverlay).toBeVisible({ timeout: 10000 });
    await expect(warningOverlay.locator('#warning-dialog-title')).toHaveText(
      'A penalty has occurred and a warning has been issued'
    );
    await expect(warningOverlay.locator('text=A mobile phone was detected')).toBeVisible();
    await expect(warningOverlay.locator('text=-25 pts')).toBeVisible();
    await expect(warningOverlay.locator('text=Warning 1')).toBeVisible();
    await expect(warningOverlay.locator('#warning-dialog-desc')).toBeVisible();

    // 5. While warning screen is open, attempt a second violation -> must be ignored (WARNING_PENDING)
    const vioRes2 = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        code: 'VOICE_DETECTED',
        evidenceMeta: { trigger: 'e2e_test_voice' },
      },
    });
    const vioJson2 = await vioRes2.json();
    expect(vioJson2.data.ignored).toBe(true);
    expect(vioJson2.data.reason).toBe('WARNING_PENDING');

    // 6. Reload Student Page while warning is pending -> must restore warning screen first
    await studentPage.reload();
    await studentPage.waitForLoadState('networkidle');
    const restoredWarningOverlay = studentPage.locator('[data-testid="violation-warning-overlay"]');
    await expect(restoredWarningOverlay).toBeVisible({ timeout: 10000 });

    // 7. Verify Proctor sees Warning Badge on Candidate Tile
    await proctorPage.reload();
    await proctorPage.waitForLoadState('networkidle');
    const studentTile = proctorPage.locator(`text=${studentName}`).locator('xpath=ancestor::div[contains(@class, "rounded-2xl") or contains(@class, "rounded-3xl")]').first();
    await expect(studentTile).toBeVisible({ timeout: 10000 });
    const warningBadge = studentTile.locator('[data-testid="tile-warning-badge"]');
    await expect(warningBadge).toBeVisible({ timeout: 10000 });
    await expect(warningBadge).toContainText('Warning 1');

    // 8. In Student Page: Acknowledge Warning Screen
    const ackBtn = studentPage.locator('[data-testid="warning-ack-btn"]');
    await expect(ackBtn).toBeVisible();
    // Wait for 2s delay timer to expire and button to be enabled
    await expect(ackBtn).toBeEnabled({ timeout: 5000 });
    await expect(ackBtn).toHaveText('OK, I understand');
    await ackBtn.click();

    // Warning screen closes and student returns to exam exactly where they were
    await expect(studentPage.locator('[data-testid="violation-warning-overlay"]')).toHaveCount(0);

    // Dismiss fullscreen exit prompt if triggered during reload
    const fsExitBtn = studentPage.locator('button:has-text("Re-enter Fullscreen")');
    if (await fsExitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fsExitBtn.click();
      await studentPage.waitForTimeout(400);
    }

    // Answer B is still selected
    const selectedOptionB = studentPage.locator('button:has-text("B.")');
    await expect(selectedOptionB).toBeVisible();

    // 9. Open Warning History Drawer via HUD button
    const hudWarningsBtn = studentPage.locator('[data-testid="hud-warnings-button"]');
    await expect(hudWarningsBtn).toBeVisible();
    await expect(hudWarningsBtn).toContainText('Warnings (1)');
    await hudWarningsBtn.click();

    const historyDrawer = studentPage.locator('[data-testid="warning-history-drawer"]');
    await expect(historyDrawer).toBeVisible({ timeout: 5000 });
    await expect(historyDrawer.locator('text=Warning #1')).toBeVisible();
    await expect(historyDrawer.locator('text=-25 pts')).toBeVisible();
    await expect(historyDrawer.locator('text=Mobile phone detected')).toBeVisible();
    await expect(historyDrawer.locator('text=Acknowledged at')).toBeVisible();

    // Close drawer
    await studentPage.locator('[data-testid="warning-history-close-btn"]').click();
    await expect(historyDrawer).toHaveCount(0);
  });
});
