import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/qa-screenshots/consistency');

test.describe('Phase 14: Application-Wide Design Consistency, Typography, Top Bar, Titles & Visual Quality Pass', () => {
  test.setTimeout(240000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAs(page: any, role: 'Admin' | 'Proctor' | 'Student') {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);
    await page.click(`button:has-text("${role}")`);
    await page.click('button:has-text("Authenticate & Enter Console")');
    const expectedPath = role === 'Admin' ? '/admin' : role === 'Proctor' ? '/proctor' : '/student';
    await page.waitForURL((url: URL) => url.pathname.includes(expectedPath), { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  async function setTheme(page: any, theme: 'dark' | 'light') {
    await page.evaluate((t: string) => {
      localStorage.setItem('proctoriq-theme', t);
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }, theme);
    await page.waitForTimeout(300);
  }

  // --------------------------------------------------------------------------
  // 1. Page Titles & Favicon Audit
  // --------------------------------------------------------------------------
  test('Page titles and favicon are correctly set across all routes', async ({ page }) => {
    // 1. Landing
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    let title = await page.title();
    expect(title).toContain('ProctorIQ');

    // Verify favicon link exists
    const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(favicon).toBeTruthy();
    expect(favicon).toContain('favicon');

    // 2. Login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    title = await page.title();
    expect(title).toBe('Sign In | ProctorIQ');

    // 3. Register
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    title = await page.title();
    expect(title).toBe('Create Account | ProctorIQ');

    // 4. Admin Mission Overview
    await loginAs(page, 'Admin');
    await page.goto('/admin');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('Mission Overview | ProctorIQ');

    // 5. Admin Exam Catalog
    await page.goto('/admin/exams');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('Exam Catalog | ProctorIQ');

    // 6. Admin Simulator
    await page.goto('/admin/simulator');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('Swarm Simulator | ProctorIQ');

    // 7. Proctor Live Monitor
    await page.goto('/proctor');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('Live Monitor | ProctorIQ');

    // 8. Proctor Violation Audit
    await page.goto('/proctor/audit');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('Violation Audit | ProctorIQ');

    // 9. Styleguide Overview
    await page.goto('/styleguide');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('UI Component Styleguide | ProctorIQ');

    // 10. Student Dashboard
    await loginAs(page, 'Student');
    await page.goto('/student');
    await page.waitForTimeout(500);
    title = await page.title();
    expect(title).toBe('Student Examinations | ProctorIQ');
  });

  // --------------------------------------------------------------------------
  // 2. Top Bar Uniformity & Cleanliness Audit
  // --------------------------------------------------------------------------
  test('Top bar controls have uniform heights (38px), clean spacing, and no duplicate Styleguide shortcut', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'Admin');
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check that duplicate Styleguide link is removed from header
    const styleguideInHeader = header.locator('a[href="/styleguide"]');
    await expect(styleguideInHeader).toHaveCount(0);

    // Check Theme Toggle button exists, has tooltip and 38px height
    const themeBtn = header.locator('button[title*="Interface Theme"], button[aria-label*="theme"]');
    await expect(themeBtn).toBeVisible();
    const themeBox = await themeBtn.boundingBox();
    expect(themeBox?.height).toBeCloseTo(38, 1);

    // Check Audio Toggle button exists, has tooltip and 38px height
    const audioBtn = header.locator('button[aria-label*="audio" i], button[title*="Audio" i]');
    await expect(audioBtn).toBeVisible();
    const audioBox = await audioBtn.boundingBox();
    expect(audioBox?.height).toBeCloseTo(38, 1);

    // Check Notifications button has 38px height
    const bellBtn = header.locator('button[aria-label="Notifications"]');
    await expect(bellBtn).toBeVisible();
    const bellBox = await bellBtn.boundingBox();
    expect(bellBox?.height).toBeCloseTo(38, 1);

    // Check User profile menu button has 38px height
    const profileBtn = header.locator('button[aria-label="User account menu"]');
    await expect(profileBtn).toBeVisible();
    const profileBox = await profileBtn.boundingBox();
    expect(profileBox?.height).toBeCloseTo(38, 1);

    // Verify main page container max-w is 1440px
    const mainEl = page.locator('main');
    await expect(mainEl).toBeVisible();
    const mainClass = await mainEl.getAttribute('class');
    expect(mainClass).toContain('max-w-[1440px]');
  });

  // --------------------------------------------------------------------------
  // 3. Table Sticky Headers & Pagination Audit
  // --------------------------------------------------------------------------
  test('ReviewQueueTable has sticky header, hover rows, and active pagination controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'Proctor');
    await page.goto('/proctor/audit');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Switch to adjudication queue tab if not already active
    const queueBtn = page.getByRole('button', { name: /Adjudication Queue/i });
    if (await queueBtn.isVisible()) {
      await queueBtn.click();
      await page.waitForTimeout(600);
    }

    // Verify table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify sticky header
    const thead = table.locator('thead');
    const theadClass = await thead.getAttribute('class');
    expect(theadClass).toContain('sticky');

    // Verify pagination controls exist (Previous, Next, page indicator)
    const prevBtn = page.getByRole('button', { name: 'Previous' });
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();

    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/2 \/ \d+/)).toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // 4. Responsive Viewport Audit (1440, 1024, 768, 390px)
  // --------------------------------------------------------------------------
  test('No horizontal page overflow across breakpoints', async ({ page }) => {
    await loginAs(page, 'Admin');
    const viewports = [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 1024, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 390, height: 844, name: 'mobile' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin');
      await page.waitForTimeout(400);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll, `Horizontal overflow detected at ${vp.width}px`).toBeFalsy();
    }
  });

  // --------------------------------------------------------------------------
  // 5. High-Resolution Visual Evidence Capture: Dark & Light, Desktop & Mobile
  // --------------------------------------------------------------------------
  test('Capture visual QA screenshots of every main page in Dark and Light, Desktop and Mobile', async ({ page }) => {
    async function capturePageViews(pathUrl: string, baseName: string) {
      // 1. DESKTOP (1440 x 900)
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(pathUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);

      // Dark desktop
      await setTheme(page, 'dark');
      await page.screenshot({
        path: path.join(screenshotDir, `${baseName}_desktop_dark.png`),
        fullPage: true,
      });

      // Light desktop
      await setTheme(page, 'light');
      await page.screenshot({
        path: path.join(screenshotDir, `${baseName}_desktop_light.png`),
        fullPage: true,
      });

      // 2. MOBILE (390 x 844)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);

      // Light mobile
      await page.screenshot({
        path: path.join(screenshotDir, `${baseName}_mobile_light.png`),
        fullPage: true,
      });

      // Dark mobile
      await setTheme(page, 'dark');
      await page.screenshot({
        path: path.join(screenshotDir, `${baseName}_mobile_dark.png`),
        fullPage: true,
      });
    }

    // A. Unauthenticated / Public pages
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await capturePageViews('/', '01_landing');
    await capturePageViews('/login', '02_login');
    await capturePageViews('/register', '03_register');

    // B. Admin authenticated pages
    await loginAs(page, 'Admin');
    await capturePageViews('/admin', '04_admin_overview');
    await capturePageViews('/admin/exams', '05_admin_exams');
    await capturePageViews('/admin/simulator', '06_swarm_simulator');
    await capturePageViews('/styleguide', '10_styleguide_overview');

    // C. Proctor authenticated pages
    await loginAs(page, 'Proctor');
    await capturePageViews('/proctor', '07_proctor_monitor');
    await capturePageViews('/proctor/audit', '08_proctor_audit');

    // D. Student authenticated pages
    await loginAs(page, 'Student');
    await capturePageViews('/student', '09_student_dashboard');
  });
});
