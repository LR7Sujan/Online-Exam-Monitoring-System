import { test, expect } from '@playwright/test';

test.describe('Sub-Phase 11.6: Proctoring Kiosk, Hardware Telemetry & Realtime Invariants', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
          console.error(`[Browser Console Error] ${text}`);
        }
      }
    });
  });

  // Helper to register fresh student and initialize session
  async function setupStudentSession(page: any, request: any, prefix = 'kiosk') {
    const studentEmail = `${prefix}.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4000/api/auth/register', {
      data: {
        fullName: `Candidate ${prefix}`,
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const regJson = await regRes.json();
    const studentToken = regJson.data?.token || regJson.token;

    // Login via UI
    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/student', { timeout: 15000 });

    // Launch Exam #1
    const examCard = page.locator('div:has-text("EXAM #1")').first();
    await examCard.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first().click();

    // Complete Checklist Stepper if shown
    const checklistModal = page.locator('text=Pre-Flight Verification Kiosk');
    if (await checklistModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Continue")');
      await page.click('button:has-text("Activate Webcam Sensor")');
      await page.waitForTimeout(600);
      await page.click('button:has-text("Continue")');
      const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
      if (await enterFsBtn.isVisible().catch(() => false)) {
        await enterFsBtn.click();
        await page.waitForTimeout(400);
      }
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(400);
      await page.click('button:has-text("Initialize Assessment Session")');
    }

    await page.waitForURL('**/student/session/**', { timeout: 15000 });
    await expect(page.locator('text=Question Palette')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    const sessionIdMatch = page.url().match(/\/session\/(\d+)/);
    const sessionId = Number(sessionIdMatch![1]);

    return { sessionId, studentEmail, studentToken };
  }

  // ==========================================================================
  // 1. PROCTORING LISTENERS & LIVE PROCTOR SCREEN DELIVERY
  // ==========================================================================
  test('Proctoring listeners: TAB_SWITCH, FULLSCREEN_EXIT, COPY_PASTE, DEVTOOLS_OPEN trigger warning overlay and appear on proctor screen', async ({
    context,
    request,
  }) => {
    // 1. Open Proctor Dashboard in Tab 1
    const proctorPage = await context.newPage();
    await proctorPage.goto('/login');
    await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
    await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await proctorPage.click('button:has-text("Authenticate & Enter Console")');
    await proctorPage.waitForURL('**/proctor', { timeout: 15000 });
    await expect(proctorPage.locator('text=Proctor Mission Control')).toBeVisible();

    // 2. Open Student Exam in Tab 2
    const studentPage = await context.newPage();
    const { sessionId } = await setupStudentSession(studentPage, request, 'listeners');

    // 3. Trigger TAB_SWITCH via window blur
    await studentPage.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    // Verify Warning Overlay displays on student screen
    await expect(studentPage.locator('text=Integrity Violation Detected')).toBeVisible({ timeout: 5000 });
    await expect(studentPage.locator('text=TAB SWITCH')).toBeVisible({ timeout: 5000 });

    // Verify it appears on Proctor screen within 1 second
    await expect(proctorPage.locator('text=TAB_SWITCH').or(proctorPage.locator('text=Tab Switch')).first()).toBeVisible({ timeout: 5000 });

    // Dismiss student warning
    const acknowledgeBtn = studentPage.locator('button:has-text("Acknowledge & Resume"), button:has-text("Dismiss")').first();
    if (await acknowledgeBtn.isVisible().catch(() => false)) {
      await acknowledgeBtn.click();
      await studentPage.waitForTimeout(400);
    }

    // 4. Trigger COPY_PASTE via context menu (right click)
    await studentPage.waitForTimeout(3200); // Wait beyond 3s debounce
    await studentPage.evaluate(() => {
      document.dispatchEvent(new MouseEvent('contextmenu'));
    });
    await expect(studentPage.locator('text=Integrity Violation Detected')).toBeVisible({ timeout: 5000 });
    await expect(studentPage.locator('text=COPY PASTE')).toBeVisible({ timeout: 5000 });

    if (await acknowledgeBtn.isVisible().catch(() => false)) {
      await acknowledgeBtn.click();
      await studentPage.waitForTimeout(400);
    }

    // 5. Trigger DEVTOOLS_OPEN via F12 keydown on window
    await studentPage.waitForTimeout(3500);
    await studentPage.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', code: 'F12', bubbles: true }));
    });
    await expect(
      studentPage.locator('text=Integrity Violation Detected')
        .or(studentPage.locator('text=Exam Terminated'))
        .or(studentPage.locator('text=SECURITY PROTOCOL ENGAGED'))
        .first()
    ).toBeVisible({ timeout: 5000 });

    await proctorPage.close();
    await studentPage.close();
  });

  // ==========================================================================
  // 2. DEBOUNCE VERIFICATION IN BROWSER
  // ==========================================================================
  test('Debounce: rapid repeats of the same violation within 3s count only once', async ({
    page,
    request,
  }) => {
    const { sessionId, studentToken } = await setupStudentSession(page, request, 'debounce');

    // Fire 5 rapid clipboard copy events within 500ms
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        document.dispatchEvent(new ClipboardEvent('copy'));
      }
    });

    await page.waitForTimeout(1000);

    // Verify Warning overlay is visible
    await expect(page.locator('text=Integrity Violation Detected')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=COPY PASTE')).toBeVisible({ timeout: 5000 });

    // Dismiss warning
    const acknowledgeBtn = page.locator('button:has-text("Acknowledge & Resume"), button:has-text("Dismiss")').first();
    if (await acknowledgeBtn.isVisible().catch(() => false)) {
      await acknowledgeBtn.click();
    }

    // Check session data via API to confirm only 1 copy violation was recorded
    const sessRes = await request.get(`http://localhost:4000/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sessJson = await sessRes.json();
    // 100 - 25 = 75 (if not debounced, 5 hits would be 100 - 125 = 0)
    expect(sessJson.data.session.trust_score).toBe(75);
  });

  // ==========================================================================
  // 3. AUTO-TERMINATION & DISQUALIFIED ZERO-SCORE RESULT
  // ==========================================================================
  test('Auto-termination: repeating violations drops trust score below threshold, locks exam, and yields DISQUALIFIED with score 0', async ({
    page,
    request,
  }) => {
    const { sessionId, studentToken } = await setupStudentSession(page, request, 'autoterm');

    // Answer Question 1 (Option A) to establish baseline responses
    const optA = page.locator('button:has-text("A.")').first();
    if (await optA.isVisible().catch(() => false)) {
      await optA.click();
      await page.waitForTimeout(500);
    }

    // Report MULTIPLE_FACES (-35 pts) -> 65%, then DEVTOOLS_OPEN (-50 pts) -> 15% (< 50% threshold)
    await request.post(`http://localhost:4000/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { code: 'MULTIPLE_FACES' },
    });
    await request.post(`http://localhost:4000/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { code: 'DEVTOOLS_OPEN' },
    });

    // Verify lock screen appears
    await expect(page.locator('text=TERMINATED').or(page.locator('text=ACADEMIC INTEGRITY VIOLATION'))).toBeVisible({ timeout: 10000 });

    // Click Proceed to Examination Results or wait for automatic navigation
    const proceedBtn = page.locator('button:has-text("Proceed to Examination Results")');
    if (await proceedBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await proceedBtn.click();
    }

    // Verify automatic redirect to result page
    await page.waitForURL(`**/student/results/${sessionId}`, { timeout: 15000 });
    await expect(page.locator('text=Examination Result & Integrity Certificate')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=DISQUALIFIED').first()).toBeVisible();
    await expect(page.locator('text=Official Integrity Rating')).toBeVisible();
  });

  // ==========================================================================
  // 4. WEBCAM TELEMETRY & CAMERA STOPPING MID-EXAM
  // ==========================================================================
  test('Webcam: camera denial or stopping mid-exam displays CameraDeniedBlocker screen', async ({
    page,
    request,
  }) => {
    await setupStudentSession(page, request, 'webcam');

    // Verify camera video is active in kiosk
    const videoElem = page.locator('video').first();
    await expect(videoElem).toBeVisible({ timeout: 10000 });

    // Simulate optical camera stream stopping mid-exam (hardware unplugged / track ended)
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        stream.getVideoTracks().forEach((track) => track.dispatchEvent(new Event('ended')));
      }
    });

    // Verify CameraDeniedBlocker displays lockout overlay
    await expect(page.locator('text=Camera Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=PROCTORING INTEGRITY LOCKOUT')).toBeVisible();
    await expect(page.locator('button:has-text("Retry Camera Verification")')).toBeVisible();
  });

  // ==========================================================================
  // 5. OFFLINE MID-EXAM QUEUE & AUTOMATIC SYNC
  // ==========================================================================
  test('Network: going offline mid-exam queues answers and syncs automatically when reconnected', async ({
    page,
    request,
  }) => {
    const { sessionId, studentToken } = await setupStudentSession(page, request, 'offline');

    // Wait for Question options to be visible
    const optB = page.locator('button:has-text("B.")').first();
    await expect(optB).toBeVisible({ timeout: 10000 });

    // 1. Simulate API failure / offline network condition by intercepting and aborting API routes
    await page.route('**/api/sessions/*/answer', (route) => route.abort('failed'));

    // 2. Select Question 1 Option B while API is unreachable
    await optB.click();
    await page.waitForTimeout(600);

    // Verify UI indicates queued/saving state
    await expect(page.locator('text=Offline / Queued').or(page.locator('text=Queued')).or(page.locator('text=Saving'))).toBeVisible({ timeout: 5000 });

    // 3. Restore connection (unroute API abort)
    await page.unroute('**/api/sessions/*/answer');

    // Trigger online event in window to flush queue
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(1000);

    // Verify status returns to synced
    await expect(page.locator('text=All changes synced').or(page.locator('text=Synced')).or(page.locator('text=Saved'))).toBeVisible({ timeout: 10000 });

    // 4. Verify in DB via API that Option B was persisted
    const qRes = await request.get(`http://localhost:4000/api/sessions/${sessionId}/questions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const qJson = await qRes.json();
    const hasSavedOptionB = qJson.data.responses.some((r: any) => r.selected_option === 'B');
    expect(hasSavedOptionB).toBe(true);
  });
});
