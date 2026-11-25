import { test, expect, type Page } from '@playwright/test';

// Global init script to track all created MediaStreamTracks and AudioContexts
const TRACKER_INIT_SCRIPT = `
  window.__createdMediaTracks = [];
  window.__createdAudioContexts = [];

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(...args) {
      const stream = await origGUM(...args);
      stream.getTracks().forEach((track) => {
        window.__createdMediaTracks.push(track);
      });
      return stream;
    };
  }

  const OrigAudioCtx = window.AudioContext || window.webkitAudioContext;
  if (OrigAudioCtx) {
    const WrappedCtx = class extends OrigAudioCtx {
      constructor(...args) {
        super(...args);
        window.__createdAudioContexts.push(this);
      }
    };
    window.AudioContext = WrappedCtx;
    if (window.webkitAudioContext) {
      window.webkitAudioContext = WrappedCtx;
    }
  }
`;

async function assertAllMediaClosed(page: Page) {
  // Wait brief tick for React unmount cleanups and async stop calls
  await page.waitForTimeout(600);

  const mediaReport = await page.evaluate(() => {
    const tracks = (window as unknown as { __createdMediaTracks?: MediaStreamTrack[] }).__createdMediaTracks || [];
    const activeTracks = tracks.filter((t) => t.readyState !== 'ended');
    const videos = Array.from(document.querySelectorAll('video'));
    const videosWithSrcObject = videos.filter((v) => v.srcObject !== null);
    const audioContexts = (window as unknown as { __createdAudioContexts?: AudioContext[] }).__createdAudioContexts || [];
    const openAudioContexts = audioContexts.filter((a) => a.state !== 'closed');

    return {
      totalTracks: tracks.length,
      activeTracksCount: activeTracks.length,
      activeTracks: activeTracks.map((t) => ({ kind: t.kind, readyState: t.readyState, label: t.label })),
      videosWithSrcObjectCount: videosWithSrcObject.length,
      openAudioContextsCount: openAudioContexts.length,
      openAudioContextsStates: openAudioContexts.map((a) => a.state),
    };
  });

  expect(mediaReport.activeTracksCount).toBe(0);
  expect(mediaReport.videosWithSrcObjectCount).toBe(0);
  expect(mediaReport.openAudioContextsCount).toBe(0);
}

async function loginStudent(page: Page, email: string, password = 'ProctorIQ#2026') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Authenticate & Enter Console")');
  await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
  await page.goto('/student');
}

async function completeChecklistAndEnterExam(page: Page) {
  const startBtn = page.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
  await startBtn.click();

  await expect(page.locator('text=Pre-Flight Verification Kiosk')).toBeVisible({ timeout: 10000 });
  // Step 1: Accept Rules
  await page.check('input[type="checkbox"]');
  await page.click('button:has-text("Continue")');

  // Step 2: Authorize Camera & Microphone
  const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
  if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await authCamBtn.click();
    await expect(page.locator('text=OPTICAL & AUDIO SENSORS ACTIVE')).toBeVisible({ timeout: 6000 });
  }
  await page.click('button:has-text("Continue")');

  // Step 3: Fullscreen Entry
  const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
  if (await enterFsBtn.isVisible().catch(() => false)) {
    await enterFsBtn.click();
    await page.waitForTimeout(400);
  }
  await page.click('button:has-text("Continue")');

  // Step 4: System Diagnostics & Launch
  await page.waitForTimeout(400);
  const launchBtn = page.locator('button:has-text("Initialize Assessment Session")');
  await launchBtn.click();

  await page.waitForURL('**/student/session/**', { timeout: 15000 });
}

test.describe('Media Session Teardown & Camera/Mic Release Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TRACKER_INIT_SCRIPT);
  });

  test('1. Student Dashboard: Closed exam card shows "Window closed" and hides countdown', async ({
    page,
  }) => {
    // Log in as Aarav Chen (seeded user with completed and closed exams from Screenshot 3)
    await loginStudent(page, 'student@proctoriq.io');

    // Switch to Completed & Graded tab
    const completedTab = page.locator('[data-testid="tab-completed"]').first();
    await expect(completedTab).toBeVisible({ timeout: 10000 });
    await completedTab.click();
    await page.waitForTimeout(600);

    // Look for Exam #3 (NET-220: Computer Networks)
    const exam3Card = page.locator('[data-testid="exam-card-3"], div:has-text("NET-220")').first();
    await expect(exam3Card).toBeVisible({ timeout: 6000 });

    // Assert "Window closed" button is displayed on Exam #3 card
    const windowClosedBtn = exam3Card.locator('[data-testid="window-closed-button"], button:has-text("Window closed")').first();
    await expect(windowClosedBtn).toBeVisible({ timeout: 6000 });
    await expect(windowClosedBtn).toBeDisabled();

    // Assert countdown timer "00:00:00" is completely hidden
    await expect(exam3Card.locator('text=Opens in 00:00:00')).not.toBeVisible();
    await expect(exam3Card.locator('text=00:00:00')).not.toBeVisible();
  });

  test('2. Pre-exam checklist cancel releases all media tracks and closes audio contexts', async ({
    page,
    request,
  }) => {
    const studentEmail = `playwright.cancelcheck.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Checklist Cancel Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();

    await loginStudent(page, studentEmail);

    const startBtn = page.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
    await startBtn.click();

    await expect(page.locator('text=Pre-Flight Verification Kiosk')).toBeVisible({ timeout: 6000 });

    // Step 1: Accept Rules
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');

    // Step 2: Authorize Camera & Microphone
    const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
    if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await authCamBtn.click();
      await expect(page.locator('text=OPTICAL & AUDIO SENSORS ACTIVE')).toBeVisible({ timeout: 6000 });
    }

    // Cancel / Close modal
    const closeBtn = page.locator('button[aria-label="Close modal"]');
    await closeBtn.click();

    await expect(page.locator('text=Pre-Flight Verification Kiosk')).not.toBeVisible();

    // Assert media teardown
    await assertAllMediaClosed(page);
  });

  test('3. Exam manual submit releases all media tracks and displays "Exam ended, camera off" on results page', async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const studentEmail = `playwright.submitrelease.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Submit Teardown Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();

    await loginStudent(page, studentEmail);
    await completeChecklistAndEnterExam(page);

    await page.waitForTimeout(1000);
    const submitBtn = page.locator('[data-testid="hud-submit-exam-button"]');
    await submitBtn.click({ force: true });

    const confirmModalBtn = page.locator('[data-testid="confirm-submit-modal-btn"]');
    await expect(confirmModalBtn).toBeVisible({ timeout: 5000 });
    await confirmModalBtn.click();

    // Wait for results page
    await page.waitForURL('**/student/results/**', { timeout: 20000 });

    // Assert camera off indicator is present on results page
    const cameraOffBadge = page.locator('[data-testid="camera-off-indicator"]');
    await expect(cameraOffBadge).toBeVisible();
    await expect(cameraOffBadge).toContainText('Exam ended, camera off');

    // Assert media teardown: every track ended, videos cleared, AudioContext closed
    await assertAllMediaClosed(page);
  });

  test('4. Navigating away mid-exam releases all media tracks', async ({
    page,
    request,
  }) => {
    const studentEmail = `playwright.navaway.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Navigate Away Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();

    await loginStudent(page, studentEmail);
    await completeChecklistAndEnterExam(page);

    // Mid-exam: navigate away to /student
    await page.goto('/student');
    await page.waitForURL(/\/student/, { timeout: 10000 });

    // Assert all tracks ended and media context shut down
    await assertAllMediaClosed(page);
  });

  test('5. Proctor force-terminate releases all media tracks', async ({
    page,
    request,
  }) => {
    // Register candidate
    const studentEmail = `playwright.force_term.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Force Terminate Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();

    // Login admin to get authorization token
    const adminLoginRes = await request.post('http://localhost:4001/api/auth/login', {
      data: {
        email: 'admin@proctoriq.io',
        password: 'ProctorIQ#2026',
      },
    });
    expect(adminLoginRes.ok()).toBeTruthy();
    const adminJson = await adminLoginRes.json();
    const adminToken = adminJson.data?.token || adminJson.token;
    expect(adminToken).toBeDefined();

    // Start exam as candidate
    await loginStudent(page, studentEmail);
    await completeChecklistAndEnterExam(page);

    const url = page.url();
    const sessionIdMatch = url.match(/\/session\/(\d+)/);
    expect(sessionIdMatch).not.toBeNull();
    const sessionId = sessionIdMatch![1];

    // Proctor issues force-terminate
    const termRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/force-terminate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { reason: 'Automated Playwright Force Disqualification' },
    });
    expect(termRes.ok()).toBeTruthy();

    // Student receives termination lockscreen or notice
    await expect(
      page.locator('text=TERMINATED').or(page.locator('text=A penalty has occurred')).or(page.locator('text=Cheating Limit Breached')).first()
    ).toBeVisible({ timeout: 8000 });

    // Assert media tracks all ended
    await assertAllMediaClosed(page);
  });
});
