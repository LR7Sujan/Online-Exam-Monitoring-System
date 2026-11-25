import { test, expect } from '@playwright/test';

test.describe('Student End-to-End Exam Proctoring Journey', () => {
  test('login -> start exam -> answer question -> trigger violations -> auto-terminate -> view result', async ({
    page,
    request,
  }) => {
    // 1. Register a fresh test candidate for a clean session flow
    const studentEmail = `playwright.candidate.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Playwright E2E Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const regJson = await regRes.json();
    const studentToken = regJson.data?.token || regJson.token;
    expect(studentToken).toBeDefined();

    // 2. User Navigates to Login Page
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });

    // Fill credentials & submit
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    // 3. User Enters Student Dashboard
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student');
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();

    // Find Exam #1 card and click Launch Pre-Exam Checklist
    const examCard = page.locator('div:has-text("EXAM #1")').first();
    await expect(examCard).toBeVisible();

    const startBtn = examCard.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
    await startBtn.click();

    // 4. Complete Pre-Exam Checklist Stepper (if modal opens)
    const checklistModal = page.locator('text=Pre-Flight Verification Kiosk');
    if (await checklistModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Step 1: Accept Rules
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Continue")');

      // Step 2: Authorize Camera & Microphone
      const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
      if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await authCamBtn.click();
        await page.waitForTimeout(600);
      }
      await page.click('button:has-text("Continue")');

      // Step 3: Fullscreen Entry
      const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
      if (await enterFsBtn.isVisible().catch(() => false)) {
        await enterFsBtn.click();
        await page.waitForTimeout(600);
      }
      await page.click('button:has-text("Continue")');

      // Step 4: System Diagnostics & Launch
      await page.waitForTimeout(400);
      const launchBtn = page.locator('button:has-text("Initialize Assessment Session")');
      await launchBtn.click();
    }

    // 5. In Exam Room: Verify Kiosk & Controls
    await page.waitForURL('**/student/session/**', { timeout: 15000 });
    await expect(page.locator('text=Question Palette')).toBeVisible({ timeout: 10000 });

    // 6. Extract Session ID from URL
    const url = page.url();
    const sessionIdMatch = url.match(/\/session\/(\d+)/);
    expect(sessionIdMatch).not.toBeNull();
    const sessionId = sessionIdMatch![1];

    // Answer Question 1 if available
    const optionButton = page.locator('button:has-text("A."), button:has-text("B."), button:has-text("Option")').first();
    if (await optionButton.isVisible().catch(() => false)) {
      await optionButton.click();
      await page.waitForTimeout(800);
    }

    // 7. Trigger Violations to Breach Trust Threshold (100 -> 65 -> 15 < 50%)
    // Report MULTIPLE_FACES (-35 pts)
    const v1Res = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { code: 'MULTIPLE_FACES' },
    });
    expect(v1Res.ok()).toBeTruthy();

    // Acknowledge Warning #1 via API to unblock Warning Gate
    await request.post(`http://localhost:4001/api/sessions/${sessionId}/warning/acknowledge`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    // Wait for 5-second post-acknowledgment grace period to elapse
    await page.waitForTimeout(5500);

    // Report DEVTOOLS_OPEN (-50 pts) -> Drops score below threshold, status flips to TERMINATED_CHEATING
    const termRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { code: 'DEVTOOLS_OPEN' },
    });
    expect(termRes.ok()).toBeTruthy();
    const termData = await termRes.json();
    console.log('termData payload:', JSON.stringify(termData));
    expect(termData.data.status).toBe('TERMINATED_CHEATING');

    // 8. Auto-Termination Screen or Lockout Overlay
    await page.waitForTimeout(1500);

    // 9. Navigate to Result Page and Verify DISQUALIFIED Integrity Status
    await page.goto(`/student/results/${sessionId}`);
    await expect(page.locator('text=Examination Result & Integrity Certificate')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=DISQUALIFIED').first()).toBeVisible();
    await expect(page.locator('text=Proctoring Incident Audit Ledger')).toBeVisible();
  });
});
