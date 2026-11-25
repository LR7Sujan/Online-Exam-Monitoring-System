import { test, expect } from '@playwright/test';

test.describe('End-to-End Time Extension Flow (Multi-Context)', () => {
  test.setTimeout(90000);

  // Helper to register fresh student and initialize session on Exam #5 (1 min test exam)
  async function setupStudentSession(page: any, request: any, prefix = 'ext-student') {
    const studentEmail = `${prefix}.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: `Candidate ${prefix}`,
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    const regJson = await regRes.json();
    const studentId = regJson.data?.user?.id || regJson.data?.id;

    // Login via UI
    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student');

    // Launch Exam #5 (1-min exam seeded for extension tests)
    const examCard = page.locator('[data-testid="exam-card-5"]');
    await expect(examCard).toBeVisible({ timeout: 10000 });
    await examCard.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first().click();

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
      await expect(launchBtn).toBeEnabled({ timeout: 10000 });
      await launchBtn.click();
    }

    await page.waitForURL('**/student/session/**', { timeout: 20000 });
    const match = page.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;

    return { studentEmail, studentId, sessionId };
  }

  test('Scenario 1: Student requests 10m from HUD button before expiry -> Proctor approves -> timer resumes with extra minutes', async ({
    browser,
    request,
  }) => {
    // 1. Create Proctor Context & Login
    const proctorContext = await browser.newContext();
    const proctorPage = await proctorContext.newPage();
    await proctorPage.goto('/login');
    await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
    await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await proctorPage.click('button:has-text("Authenticate & Enter Console")');
    await proctorPage.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await proctorPage.goto('/proctor');
    await expect(proctorPage.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    // 2. Create Student Context & Start 1-min Exam
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const { studentEmail, sessionId } = await setupStudentSession(studentPage, request, 'hud-approve-test');

    // Select Answer Option B on Question 1
    const optionB = studentPage.locator('button:has-text("B.")');
    await optionB.click();
    await studentPage.waitForTimeout(500);

    // Verify persistent "Request extra time" button in top HUD (<= 10 mins remaining)
    const hudBtn = studentPage.locator('[data-testid="hud-request-extension-button"]');
    await expect(hudBtn).toBeVisible({ timeout: 5000 });

    // Click "Request extra time" from the HUD button before expiry
    await hudBtn.click();

    // Verify Time Extension Modal opens
    await expect(studentPage.getByRole('heading', { name: 'Request Extra Time' })).toBeVisible({ timeout: 5000 });

    // Select 10 minutes and submit request
    await studentPage.click('button:has-text("+10 mins")');
    await studentPage.fill('textarea', 'Need extra minutes to review final questions');
    await studentPage.getByRole('button', { name: 'Request Extra Time', exact: true }).click();

    // Verify Student Waiting Screen is shown inside modal
    await expect(studentPage.locator('text=Request Sent to Your Proctor')).toBeVisible({ timeout: 5000 });
    await expect(studentPage.locator('text=Awaiting proctor review')).toBeVisible();

    // Verify HUD button now shows "Request pending"
    const pendingHudBtn = studentPage.locator('[data-testid="hud-request-pending-button"]');
    await expect(pendingHudBtn).toBeVisible();

    // 3. Switch to Proctor Context -> Proctor sees request within drawer
    const timeRequestsBtn = proctorPage.locator('button:has-text("Time Requests")');
    await expect(timeRequestsBtn).toBeVisible();
    await timeRequestsBtn.click();
    await expect(proctorPage.locator('h3:has-text("Time Extension Requests")')).toBeVisible({ timeout: 10000 });

    // Locate the request card for this candidate
    const reqCard = proctorPage.locator('[data-testid="extension-request-card"]').first();
    await expect(reqCard).toBeVisible({ timeout: 10000 });

    // Proctor approves 10m
    await reqCard.locator('button:has-text("Custom")').click();
    await reqCard.getByRole('button', { name: '10m', exact: true }).click();
    await reqCard.locator('button:has-text("Approve 10m")').click();

    // 4. Switch to Student Context -> Student timer resumes with extra minutes and answers unlock
    await expect(studentPage.locator('text=Extra time approved! +10 minutes granted')).toBeVisible({ timeout: 8000 });
    await expect(studentPage.locator('text=Request Sent to Your Proctor')).not.toBeVisible();

    // Check that timer has resumed with granted time (around 9:59 to 10:00)
    const timerText = await studentPage.locator('[data-testid="exam-timer"]').textContent();
    expect(timerText).toMatch(/09:[4-5]\d|10:00/);

    // Verify answers are UNLOCKED: select option C on question 1
    const optionC = studentPage.locator('button:has-text("C.")');
    await optionC.click();
    await studentPage.waitForTimeout(400);

    // Clean up
    await studentContext.close();
    await proctorContext.close();
  });

  test('Scenario 2: Student waits until time is up -> modal opens in grace window -> request succeeds without error', async ({
    browser,
    request,
  }) => {
    // 1. Student Login & Session on Exam #5 (1-minute exam)
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const { studentEmail, sessionId } = await setupStudentSession(studentPage, request, 'grace-success-test');

    // Answer Question 1
    await studentPage.locator('button:has-text("B.")').click();
    await studentPage.waitForTimeout(500);

    // Fast-forward session to 2 seconds remaining to reach 0 and enter grace window
    const adminLogin = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const adminToken = (await adminLogin.json()).data.token;
    await request.post('http://localhost:4001/api/admin/system/fast-forward', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { sessionId, secondsLeft: 2 },
    });

    // Wait for the modal to open in grace window
    const extModal = studentPage.getByRole('heading', { name: 'Time is up. Do you need extra time?' });
    await expect(extModal).toBeVisible({ timeout: 15000 });

    // Request extra time while in grace window
    await studentPage.click('button:has-text("+10 mins")');
    await studentPage.fill('textarea', 'Requesting inside grace window');
    await studentPage.getByRole('button', { name: 'Request Extra Time', exact: true }).click();

    // Crucial check: Must NOT show the error "Cannot request time extension for an exam that is not in progress."
    await expect(studentPage.locator('text=Cannot request time extension for an exam that is not in progress.')).not.toBeVisible();

    // Verify request succeeded and transitioned to the waiting screen
    await expect(studentPage.locator('text=Request Sent to Your Proctor')).toBeVisible({ timeout: 5000 });
    await expect(studentPage.locator('text=Awaiting proctor review')).toBeVisible();

    // Clean up
    await studentContext.close();
  });
});
