import { test, expect } from '@playwright/test';

test.describe('Student Role Complete User Journey', () => {
  // Capture uncaught console errors
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Ignore known benign network favicon/media stream warnings if any
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
          console.error(`[Browser Console Error] ${text}`);
        }
      }
    });
  });

  test('STUDENT: login -> dashboard -> start exam (checklist) -> answer, change answer, palette navigation -> reload persistence -> submit -> result page', async ({
    page,
    request,
  }) => {
    // 1. Create a clean student account for this complete exam journey
    const timestamp = Date.now();
    const studentEmail = `student.journey.${timestamp}@proctoriq.io`;
    const password = 'ProctorIQ#2026';

    const registerRes = await request.post('http://localhost:4000/api/auth/register', {
      data: {
        fullName: 'Jane Doe Candidate',
        email: studentEmail,
        password,
      },
    });
    expect(registerRes.ok()).toBeTruthy();

    // 2. Login as the student
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });

    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Authenticate & Enter Console")');

    // 3. Verify Candidate Dashboard
    await page.waitForURL('**/student', { timeout: 15000 });
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();
    await expect(page.locator(`text=Welcome, Jane Doe Candidate`)).toBeVisible();

    // 4. Start Exam via Pre-Exam Checklist Stepper
    const examCard = page.locator('div:has-text("EXAM #1")').first();
    await expect(examCard).toBeVisible();

    const startBtn = examCard.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
    await startBtn.click();

    // Stepper verification
    const checklistModal = page.locator('text=Pre-Flight Verification Kiosk');
    await expect(checklistModal).toBeVisible({ timeout: 10000 });

    // Step 1: Accept Rules
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');

    // Step 2: Authorize Camera
    await page.click('button:has-text("Activate Webcam Sensor")');
    await page.waitForTimeout(600);
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

    // 5. Verify In-Exam Room & UI Components
    await page.waitForURL('**/student/session/**', { timeout: 15000 });
    await expect(page.locator('text=Question Palette')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=QUESTION 1 OF').first()).toBeVisible();

    // Extract Session ID
    const url = page.url();
    const match = url.match(/\/session\/(\d+)/);
    expect(match).not.toBeNull();
    const sessionId = match![1];

    // 6. Select an answer for Question 1 (Option A)
    const optAButton = page.locator('button:has-text("A.")').first();
    await optAButton.click();
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    // 7. Change answer to Option B
    const optBButton = page.locator('button:has-text("B.")').first();
    await optBButton.click();
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    // 8. Navigate with Prev / Next Buttons
    const nextBtn = page.locator('button:has-text("Next Question")');
    await nextBtn.click();
    await expect(page.locator('text=QUESTION 2 OF').first()).toBeVisible({ timeout: 5000 });

    // 9. Navigate back using Question Palette
    const paletteQ1 = page.locator('div:has-text("Question Palette") button:has-text("1")').first();
    await paletteQ1.click();
    await expect(page.locator('text=QUESTION 1 OF').first()).toBeVisible({ timeout: 5000 });

    // 10. Refresh mid-exam: answers and timer must persist
    await page.reload();
    await page.waitForURL(`**/student/session/${sessionId}`, { timeout: 15000 });
    await expect(page.locator('text=Question Palette')).toBeVisible({ timeout: 10000 });

    // Confirm Option B is still selected after refresh
    const refreshedOptB = page.locator('button:has-text("B.")').first();
    await expect(refreshedOptB).toHaveClass(/border-brand/);

    // Dismiss any warning or fullscreen overlay if visible
    const ackBtn = page.locator('button:has-text("Acknowledge & Resume Exam"), button:has-text("Re-enter Fullscreen & Continue")').first();
    if (await ackBtn.isVisible().catch(() => false)) {
      await ackBtn.click();
      await page.waitForTimeout(400);
    }

    // 11. Submit Exam
    const submitBtn = page.locator('button:has-text("Submit Exam")').first();
    await submitBtn.click();

    // Confirmation modal
    const confirmModal = page.locator('button:has-text("Confirm & Submit")');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await confirmModal.click();

    // 12. Verify Official Result Page
    await page.waitForURL(`**/student/results/${sessionId}`, { timeout: 15000 });
    await expect(page.locator('text=Examination Result & Integrity Certificate')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Proctoring Incident Audit Ledger')).toBeVisible();
    await expect(page.locator('text=CLEAN').or(page.locator('text=FLAGGED')).first()).toBeVisible();
  });

  test('STUDENT: starting outside the window shows disabled button with countdown', async ({
    page,
    request,
  }) => {
    // Create an exam scheduled far in the future
    const adminLoginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const adminToken = (await adminLoginRes.json()).data.token;

    const futureStart = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

    const createExamRes = await request.post('http://localhost:4000/api/exams', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: `Future Scheduled Exam ${Date.now()}`,
        description: 'Exam starting next week',
        durationMinutes: 45,
        minTrustScore: 50,
        startWindow: futureStart,
        endWindow: futureEnd,
        isPublished: true,
      },
    });
    expect(createExamRes.ok()).toBeTruthy();

    // Login as existing student
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/student', { timeout: 15000 });

    // Switch to Upcoming Window tab
    await page.click('button:has-text("Upcoming Window")');

    // Verify future exam card has disabled button with countdown
    const upcomingCard = page.locator('div:has-text("Exam starting next week")').first();
    await expect(upcomingCard).toBeVisible({ timeout: 10000 });

    const launchBtn = page.locator('button:has-text("Opens in")').first();
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await expect(launchBtn).toBeDisabled();
  });

  test('STUDENT: opening the same exam in a second tab resumes seamlessly without conflict', async ({
    page,
    context,
    request,
  }) => {
    const studentEmail = `student.multitab.${Date.now()}@proctoriq.io`;
    const password = 'ProctorIQ#2026';

    await request.post('http://localhost:4000/api/auth/register', {
      data: { fullName: 'Multi-Tab Student', email: studentEmail, password },
    });

    // 1. Login in tab 1
    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/student', { timeout: 15000 });

    // Start exam 1
    const examCard = page.locator('div:has-text("EXAM #1")').first();
    const startBtn = examCard.locator('button:has-text("Launch Pre-Exam Checklist")').first();
    await startBtn.click();

    // Fast-track checklist
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("Activate Webcam Sensor")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Continue")');
    const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
    if (await enterFsBtn.isVisible().catch(() => false)) {
      await enterFsBtn.click();
    }
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("Initialize Assessment Session")');

    await page.waitForURL('**/student/session/**', { timeout: 15000 });
    const sessionUrl = page.url();

    // 2. Open a second page in the same browser context (sharing auth tokens)
    const secondPage = await context.newPage();
    await secondPage.goto(sessionUrl);
    await secondPage.waitForURL('**/student/session/**', { timeout: 15000 });

    // Confirm Question Palette loads and no 409 error or crash occurs
    await expect(secondPage.locator('text=Question Palette')).toBeVisible({ timeout: 10000 });
    await expect(secondPage.locator('text=QUESTION 1 OF')).toBeVisible();

    await secondPage.close();
  });
});
