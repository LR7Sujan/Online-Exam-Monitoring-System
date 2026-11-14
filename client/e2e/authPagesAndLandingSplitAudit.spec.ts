import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/qa-screenshots');

test.describe('Phase 13: Split Landing, Login & Registration Pages Audit', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Landing Page (/) Verification
  // --------------------------------------------------------------------------
  test('Landing page (/) renders complete marketing layout, sticky header, hero, bento, 3-step pipeline & footer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    // 1. Sticky header: logo, links, Sign in, Get started, theme toggle
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByText('ProctorIQ')).toBeVisible();
    await expect(header.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'How it works' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Security' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Get started' })).toBeVisible();

    // 2. Hero: headline, subtitle, two CTAs, floating dashboard card
    const heroHeadline = page.getByRole('heading', { level: 1, name: /Mission Control for ProctorIQ/i });
    await expect(heroHeadline).toBeVisible();
    await expect(page.getByText(/Authoritative anti-cheating orchestration/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Get started free/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Operator Sign in/i }).first()).toBeVisible();

    // 3. Stats Strip
    await expect(page.getByText('99.98%')).toBeVisible();
    await expect(page.getByText('< 20ms').first()).toBeVisible();
    await expect(page.getByText('100%', { exact: true })).toBeVisible();

    // 4. Feature Bento
    await expect(page.getByRole('heading', { name: 'Real-time Monitoring' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trust Score Engine' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Face Detection' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();

    // 5. 3-step "How it works"
    await expect(page.getByText('How ProctorIQ Secures Exams in 3 Steps')).toBeVisible();
    await expect(page.getByText('01', { exact: true })).toBeVisible();
    await expect(page.getByText('Configure Assessment')).toBeVisible();
    await expect(page.getByText('02', { exact: true })).toBeVisible();
    await expect(page.getByText('Neural Live Surveillance')).toBeVisible();
    await expect(page.getByText('03', { exact: true })).toBeVisible();
    await expect(page.getByText('ACID Auto-Adjudication')).toBeVisible();

    // 6. Final CTA Banner & Footer
    await expect(page.getByText('Ready to Initialize Assessment Session?')).toBeVisible();
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/ALL SYSTEMS NOMINAL/i)).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'split_landing_page_1440px.png'),
      fullPage: true,
    });
  });

  // --------------------------------------------------------------------------
  // 2. Login Page (/login) with AuthLayout
  // --------------------------------------------------------------------------
  test('Login page (/login) renders AuthLayout split screen on desktop and single column on mobile', async ({ page }) => {
    // Desktop Viewport (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Left brand panel is visible on desktop
    const leftAside = page.locator('aside');
    await expect(leftAside).toBeVisible();
    await expect(leftAside.getByText('Client-Side Neural Face & Gaze Tracking')).toBeVisible();
    await expect(leftAside.getByText('Sub-20ms WebSocket Telemetry Stream')).toBeVisible();
    await expect(leftAside.getByText('ACID Auto-Deduct Trigger Guarantees')).toBeVisible();
    await expect(leftAside.getByText('Dr. Elena Vance')).toBeVisible();

    // Right form card (max-w-[420px])
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText('ProctorIQ Access')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const pwdInput = page.locator('input#login-password');
    await expect(pwdInput).toBeVisible();
    await expect(pwdInput).toHaveAttribute('type', 'password');

    // Show/Hide password toggle
    const toggleBtn = page.locator('button[aria-label="Show password"]');
    await toggleBtn.click();
    await expect(pwdInput).toHaveAttribute('type', 'text');
    await page.locator('button[aria-label="Hide password"]').click();
    await expect(pwdInput).toHaveAttribute('type', 'password');

    // Remember me checkbox
    await expect(page.getByText('Remember me')).toBeVisible();

    // Link to register
    const registerLink = page.getByRole('link', { name: /Sign up here/i });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute('href', '/register');

    await page.screenshot({
      path: path.join(screenshotDir, 'split_login_page_1440px.png'),
    });

    // Mobile Viewport (390px): Left aside hidden, card centered
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await expect(leftAside).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'split_login_page_390px.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 3. Login Authentication Across All 3 Roles
  // --------------------------------------------------------------------------
  test('All 3 roles log in smoothly via role tabs/chips and land on their respective dashboards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // A) Proctor login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.click('button:has-text("Proctor")');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url) => url.pathname.includes('/proctor'), { timeout: 15000 });
    expect(page.url()).toContain('/proctor');

    // B) Admin login (sign out and sign in as Admin)
    await page.goto('/login');
    // If logged-in redirect takes us back, let's clear localStorage
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.click('button:has-text("Admin")');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url) => url.pathname.includes('/admin'), { timeout: 15000 });
    expect(page.url()).toContain('/admin');

    // C) Student login
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.click('button:has-text("Student")');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url) => url.pathname.includes('/student'), { timeout: 15000 });
    expect(page.url()).toContain('/student');
  });

  // --------------------------------------------------------------------------
  // 4. Registration Page (/register) & New Student Flow
  // --------------------------------------------------------------------------
  test('Registration page (/register) renders AuthLayout, validates fields, and provisions a new Student', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/register');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Verify AuthLayout & Form Header
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByText('Candidate Self-Registration (STUDENT)')).toBeVisible();

    // Verify Fields
    const fullNameInput = page.locator('input#register-fullname');
    const emailInput = page.locator('input#register-email');
    const pwdInput = page.locator('input#register-password');
    const confirmPwdInput = page.locator('input#register-confirm-password');

    await expect(fullNameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(pwdInput).toBeVisible();
    await expect(confirmPwdInput).toBeVisible();

    // Link back to Login
    const loginLink = page.getByRole('link', { name: /Sign in here/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');

    // Screenshot of Register Page
    await page.screenshot({
      path: path.join(screenshotDir, 'split_register_page_1440px.png'),
    });

    // Test Validation: submitting empty form shows errors
    await page.click('button:has-text("Provision Candidate Account")');
    await expect(page.getByText('Full name must be at least 2 characters.')).toBeVisible();

    // Fill valid registration details with dynamic unique email
    const uniqueEmail = `cadet_${Date.now()}@proctoriq.io`;
    await fullNameInput.fill('Jordan Blake');
    await emailInput.fill(uniqueEmail);
    await pwdInput.fill('ProctorPass#2026');

    // Verify Password Strength Meter appears
    await expect(page.getByText(/Strength:/i)).toBeVisible();

    await confirmPwdInput.fill('ProctorPass#2026');

    // Check Terms checkbox
    await page.locator('input[type="checkbox"]').check();

    // Submit Registration
    await page.click('button:has-text("Provision Candidate Account")');

    // Must navigate directly to /student dashboard
    await page.waitForURL((url) => url.pathname.includes('/student'), { timeout: 15000 });
    expect(page.url()).toContain('/student');
  });

  // --------------------------------------------------------------------------
  // 5. Logged-in Redirection Safety
  // --------------------------------------------------------------------------
  test('Logged-in users visiting /, /login, or /register are redirected to their dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Authenticate as student
    await page.goto('/login');
    await page.click('button:has-text("Student")');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url) => url.pathname.includes('/student'), { timeout: 15000 });

    // Visiting /login redirects to /student
    await page.goto('/login');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    expect(page.url()).toContain('/student');

    // Visiting /register redirects to /student
    await page.goto('/register');
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });
    expect(page.url()).toContain('/student');

    // Visiting / redirects to /student
    await page.goto('/');
    await page.waitForURL((url) => url.pathname !== '/', { timeout: 10000 });
    expect(page.url()).toContain('/student');
  });
});
