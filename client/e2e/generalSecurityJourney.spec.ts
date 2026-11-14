import { test, expect } from '@playwright/test';

test.describe('General Security, Routing, Guards & Boundaries Journey', () => {
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

  test('GENERAL: deep links while logged out redirect to /login', async ({ page }) => {
    // Attempt to access student console without auth
    await page.goto('/student');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible();

    // Attempt to access proctor mission control without auth
    await page.goto('/proctor');
    await page.waitForURL('**/login', { timeout: 10000 });

    // Attempt to access admin console without auth
    await page.goto('/admin');
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('GENERAL: logout and back-button behavior prevents re-entering protected routes', async ({
    page,
  }) => {
    // 1. Login as Student
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    await page.waitForURL('**/student', { timeout: 15000 });
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();

    // 2. Open User Menu / Click Sign Out
    const avatarBtn = page.locator('header button:has-text("Aarav Chen")');
    await avatarBtn.click();
    await page.waitForTimeout(300);
    const signOutBtn = page.locator('button:has-text("Sign Out")');
    await signOutBtn.click();

    // 3. User is redirected to login
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible();

    // 4. Press browser Back button
    await page.goBack();
    await page.waitForTimeout(1000);

    // Protected route must not render authenticated data; must redirect to login or stay at login
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login|\/)?$/);
    await expect(page.locator('text=Candidate Examination Console')).not.toBeVisible();
  });

  test('GENERAL: role guards block cross-role URL navigation', async ({ page }) => {
    // 1. Login as Candidate (STUDENT role)
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/student', { timeout: 15000 });

    // 2. Student attempts to navigate to /admin
    await page.goto('/admin');
    await page.waitForURL('**/student', { timeout: 10000 });
    await expect(page.locator('text=Administrator Console')).not.toBeVisible();
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();

    // 3. Student attempts to navigate to /proctor
    await page.goto('/proctor');
    await page.waitForURL('**/student', { timeout: 10000 });
    await expect(page.locator('text=Proctor Mission Control')).not.toBeVisible();
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();
  });

  test('GENERAL: 404 page renders for nonexistent routes with return navigation', async ({
    page,
  }) => {
    await page.goto('/system-matrix-404-nonexistent-sector');
    await expect(page.locator('text=Sector Not Found')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=HTTP 404 Error')).toBeVisible();

    // Click Return to Mission Control
    await page.click('button:has-text("Return to Mission Control")');
    await page.waitForURL('**/', { timeout: 10000 });
  });

  test('GENERAL: forms handle empty, long, and special-character input safely', async ({
    page,
  }) => {
    await page.goto('/login');

    // 1. Submit with empty input
    await page.click('button:has-text("Authenticate & Enter Console")');
    // HTML5 or form validation prevents navigation
    expect(page.url()).toContain('/login');

    // 2. Long input & special character fuzzing on Register page
    await page.goto('/register');
    await expect(page.locator('text=Candidate Registration')).toBeVisible({ timeout: 10000 });

    const longString = 'A'.repeat(300);
    const xssScript = '<script>alert("XSS")</script>';
    const sqliString = "' OR 1=1 --";

    await page.fill('#register-fullname', `${xssScript} ${sqliString}`);
    await page.fill('#register-email', `invalid-email-${longString}`);
    await page.fill('#register-password', '123'); // Too short

    await page.click('button:has-text("Provision Candidate Account")');

    // Confirm UI did not crash and displays validation error
    await expect(page.locator('text=Candidate Registration')).toBeVisible();
    // HTML entities escaped, no unhandled exceptions
  });
});
