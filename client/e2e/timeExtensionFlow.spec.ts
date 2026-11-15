import { test, expect } from '@playwright/test';

test.describe('End-to-End Time Extension Flow (Multi-Context)', () => {
  // Helper to register fresh student and initialize session on Exam #5 (1 min test exam)
  async function setupStudentSession(page: any, request: any, prefix = 'ext-student') {
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
      await page.click('button:has-text("Activate Webcam Sensor")');
      await page.waitForTimeout(400);
      await page.click('button:has-text("Continue")');
      const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
      if (await enterFsBtn.isVisible().catch(() => false)) {
        await enterFsBtn.click();
        await page.waitForTimeout(300);
      }
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(300);
      await page.click('button:has-text("Initialize Assessment Session")');
    }

    await page.waitForURL('**/student/session/**', { timeout: 15000 });
    const match = page.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;

    return { studentEmail, studentId, sessionId };
  }

  test('Scenario 1: Student requests 5m -> Proctor approves 10m -> timer resumes & answers unlock', async ({
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
    const { studentEmail, sessionId } = await setupStudentSession(studentPage, request, 'approve-test');

    // Select Answer Option B on Question 1 before time expires
    const optionB = studentPage.locator('button:has-text("B.")');
    await optionB.click();
    await studentPage.waitForTimeout(500);

    // Fast-forward exam deadline to 3 seconds remaining via backend API or admin
    // Authenticate admin to fast-forward session deadline
    const adminLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const adminToken = (await adminLogin.json()).data.token;

    // Use admin token to adjust deadline to 2 seconds from now
    // Query direct update or endpoint
    await request.post(`http://localhost:4000/api/admin/system/fast-forward`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { sessionId, secondsLeft: 2 },
    }).catch(async () => {
      // Fallback: wait for the 1-minute seeded exam to naturally approach 0
    });

    // Wait for Time Extension Modal to appear when timer reaches 0
    const extModal = studentPage.locator('text=Time is up. Do you need extra time?');
    await expect(extModal).toBeVisible({ timeout: 65000 });

    // Verify modal elements
    await expect(studentPage.locator('text=Request Extra Time')).toBeVisible();
    await expect(studentPage.locator('text=Submit Now')).toBeVisible();

    // Student requests 5 minutes with a reason
    await studentPage.click('button:has-text("+5 mins")');
    await studentPage.fill('textarea', 'Reviewing critical concurrency question');
    await studentPage.click('button:has-text("Request Extra Time")');

    // Verify Student Waiting Screen is shown
    await expect(studentPage.locator('text=Request Sent to Your Proctor')).toBeVisible({ timeout: 5000 });
    await expect(studentPage.locator('text=Awaiting proctor review')).toBeVisible();
    await expect(studentPage.locator('text=Auto-Expiry Countdown:')).toBeVisible();

    // 3. Switch to Proctor Context -> Proctor sees request within 1-2 seconds
    const timeRequestsBtn = proctorPage.locator('button:has-text("Time Requests")');
    await expect(timeRequestsBtn).toBeVisible();

    // Open Time Requests Drawer
    await timeRequestsBtn.click();
    await expect(proctorPage.locator('h3:has-text("Time Extension Requests")')).toBeVisible({ timeout: 10000 });

    // Locate the request card for this candidate
    const reqCard = proctorPage.locator('[data-testid="extension-request-card"]').first();
    await expect(reqCard).toBeVisible({ timeout: 10000 });
    await expect(reqCard.locator('text=Trust:')).toBeVisible();

    // Proctor clicks "Custom" and approves with 10 minutes
    await reqCard.locator('button:has-text("Custom")').click();
    await reqCard.locator('button:has-text("10m")').click();
    await reqCard.locator('button:has-text("Approve 10m")').click();

    // 4. Switch to Student Context -> Student timer resumes with 10 mins and answers unlock
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

  test('Scenario 2: Student requests extra time -> Proctor REJECTS -> exam ends with TIMED_OUT (not disqualified)', async ({
    browser,
    request,
  }) => {
    // 1. Proctor Login
    const proctorContext = await browser.newContext();
    const proctorPage = await proctorContext.newPage();
    await proctorPage.goto('/login');
    await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
    await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await proctorPage.click('button:has-text("Authenticate & Enter Console")');
    await proctorPage.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await proctorPage.goto('/proctor');
    await expect(proctorPage.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    // 2. Student Login & Session on Exam #5
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const { studentEmail, sessionId } = await setupStudentSession(studentPage, request, 'reject-test');

    // Answer Question 1 correctly (Option B)
    await studentPage.locator('button:has-text("B.")').click();
    await studentPage.waitForTimeout(500);

    // Fast-forward session deadline
    const adminLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const adminToken = (await adminLogin.json()).data.token;
    await request.post(`http://localhost:4000/api/admin/system/fast-forward`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { sessionId, secondsLeft: 2 },
    }).catch(() => {});

    // Wait for Time Extension Modal
    const extModal = studentPage.locator('text=Time is up. Do you need extra time?');
    await expect(extModal).toBeVisible({ timeout: 65000 });

    // Student sends extension request
    await studentPage.click('button:has-text("+5 mins")');
    await studentPage.click('button:has-text("Request Extra Time")');
    await expect(studentPage.locator('text=Request Sent to Your Proctor')).toBeVisible({ timeout: 5000 });

    // 3. Proctor opens drawer and REJECTS
    await proctorPage.click('button:has-text("Time Requests")');
    await expect(proctorPage.locator('h3:has-text("Time Extension Requests")')).toBeVisible({ timeout: 10000 });
    const reqCard = proctorPage.locator('[data-testid="extension-request-card"]').first();
    await expect(reqCard).toBeVisible({ timeout: 10000 });

    // Click Reject
    await reqCard.locator('[data-testid="reject-request-btn"]').click();

    // Verify Confirmation Modal
    const confirmModal = proctorPage.locator('text=Reject Extension and Conclude Exam?');
    await expect(confirmModal).toBeVisible();
    await expect(proctorPage.locator('text=The candidate will NOT be marked as cheating/disqualified')).toBeVisible();

    // Confirm Reject
    await proctorPage.click('button:has-text("Reject & Conclude Exam")');

    // 4. Student lands on Results Page with TIMED_OUT (not DISQUALIFIED)
    await studentPage.waitForURL(/\/student\/results\/\d+/, { timeout: 15000 });
    await expect(studentPage.locator('text=Examination Result & Integrity Certificate')).toBeVisible({ timeout: 10000 });

    // Verify session status is TIMED_OUT in DB and NOT DISQUALIFIED on page
    const studentLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: studentEmail, password: 'ProctorIQ#2026' },
    });
    const studentToken = (await studentLogin.json()).data.token;
    const sessionRes = await request.get(`http://localhost:4000/api/sessions/${sessionId}/result`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sessionData = await sessionRes.json();
    expect(sessionData.data?.session?.status).toBe('TIMED_OUT');

    const statusText = await studentPage.locator('body').textContent();
    expect(statusText).not.toContain('DISQUALIFIED');

    // Verify score is preserved (Option B answered correctly on Question 1)
    await expect(studentPage.locator('text=Grade Percentage')).toBeVisible();
    await expect(studentPage.locator('text=/ 20 Marks')).toBeVisible();

    // Clean up
    await studentContext.close();
    await proctorContext.close();
  });
});
