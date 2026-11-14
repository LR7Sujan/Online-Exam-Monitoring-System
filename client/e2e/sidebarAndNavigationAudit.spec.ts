import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/qa-screenshots');

test.describe('Phase 13: Sidebar Redesign, Overlay Safety & Seamless Route Navigation', () => {
  test.setTimeout(180000); // 3 minutes

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAs(page: any, email: string) {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  // --------------------------------------------------------------------------
  // 1. Sidebar Expanded (260px) Geometry & Full Viewport Height
  // --------------------------------------------------------------------------
  test('Expanded Sidebar (260px) spans full viewport height with pinned footer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.round(box.width)).toBe(260);
      expect(Math.round(box.height)).toBe(900); // Exact full viewport height
    }

    // Header exists
    await expect(sidebar.locator('text=Surveillance Engine')).toBeVisible();

    // Section headers exist
    await expect(sidebar.getByText('CORE', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('SURVEILLANCE', { exact: true })).toBeVisible();

    // Node status card exists in pinned footer
    await expect(sidebar.locator('text=NODE ONLINE')).toBeVisible();
    await expect(sidebar.locator('text=MYSQL 8.0 • WSS')).toBeVisible();

    // Take screenshot of expanded sidebar
    await page.screenshot({
      path: path.join(screenshotDir, 'sidebar_expanded_1440px_dark.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 2. Sidebar Collapsed (72px) Geometry, Logo Centering & Status Dot
  // --------------------------------------------------------------------------
  test('Collapsed Sidebar (72px) keeps logo centered, status dot circular, and persists in localStorage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'proctor@proctoriq.io');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Click circular collapse button on border seam
    const collapseBtn = sidebar.locator('button[aria-label="Collapse sidebar"]');
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await page.waitForTimeout(500); // allow spring animation to settle

    // Check width is 72px
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.round(box.width)).toBe(72);
      expect(Math.round(box.height)).toBe(900);
    }

    // Brand text should be hidden
    await expect(sidebar.locator('text=Surveillance Engine')).not.toBeVisible();

    // Logo icon container must be visible and within bounds
    const logoIcon = sidebar.locator('a[href="/"] div.h-10.w-10').first();
    await expect(logoIcon).toBeVisible();
    const logoBox = await logoIcon.boundingBox();
    expect(logoBox).not.toBeNull();
    if (logoBox && box) {
      expect(logoBox.x).toBeGreaterThanOrEqual(box.x);
      expect(logoBox.x + logoBox.width).toBeLessThanOrEqual(box.x + box.width);
    }

    // Circular status dot in footer is visible and unclipped
    const statusCircle = sidebar.locator('div.w-10.h-10.rounded-full').first();
    await expect(statusCircle).toBeVisible();

    // Check localStorage persistence
    const saved = await page.evaluate(() => localStorage.getItem('proctoriq-sidebar-collapsed'));
    expect(saved).toBe('true');

    // Take screenshot of collapsed sidebar
    await page.screenshot({
      path: path.join(screenshotDir, 'sidebar_collapsed_1440px_dark.png'),
    });

    // Refresh page and confirm collapsed state persisted
    await page.reload();
    await page.waitForTimeout(400);
    const reloadedBox = await sidebar.boundingBox();
    expect(reloadedBox).not.toBeNull();
    if (reloadedBox) {
      expect(Math.round(reloadedBox.width)).toBe(72);
    }

    // Toggle back to expanded
    const expandBtn = sidebar.locator('button[aria-label="Expand sidebar"]');
    await expandBtn.click();
    await page.waitForTimeout(500);
    const expandedBox = await sidebar.boundingBox();
    expect(expandedBox).not.toBeNull();
    if (expandedBox) {
      expect(Math.round(expandedBox.width)).toBe(260);
    }
  });

  // --------------------------------------------------------------------------
  // 3. Mobile & Tablet Off-Canvas Drawer (< 1024px)
  // --------------------------------------------------------------------------
  test('Mobile (< 1024px) renders off-canvas navigation drawer with backdrop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'student@proctoriq.io');

    // Desktop sidebar is hidden on mobile
    const desktopSidebar = page.locator('aside');
    await expect(desktopSidebar).not.toBeVisible();

    // Hamburger button is visible in header
    const hamburger = page.locator('header button[aria-label="Open navigation menu"]');
    await expect(hamburger).toBeVisible();

    // Open mobile drawer
    await hamburger.click();
    await page.waitForTimeout(350);

    // Mobile drawer backdrop and panel are visible
    const mobileDrawer = page.locator('div[role="dialog"], div.fixed.inset-0.bg-black\\/60');
    await expect(mobileDrawer).toBeVisible();

    // Take screenshot of mobile drawer
    await page.screenshot({
      path: path.join(screenshotDir, 'sidebar_mobile_drawer_390px.png'),
    });

    // Close mobile drawer via close button
    const closeBtn = page.locator('button[aria-label="Close navigation menu"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(350);

    // Mobile drawer is dismissed
    await expect(mobileDrawer).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 4. REGRESSION TEST: 3 Continuous Navigation Cycles Without Page Reload
  // --------------------------------------------------------------------------
  test('Continuous multi-cycle sidebar navigation displays valid headings without blank pages or errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('MediaStream')) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Test PROCTOR Navigation (Monitor <-> Audit <-> Styleguide)
    await loginAs(page, 'proctor@proctoriq.io');

    const proctorRoutes = [
      { href: '/proctor', expectedHeading: 'Live Telemetry Grid' },
      { href: '/proctor/audit', expectedHeading: 'Adjudication' },
      { href: '/styleguide', expectedHeading: 'UI Component Styleguide' },
    ];

    // Execute 3 full continuous cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      for (const target of proctorRoutes) {
        const link = page.locator(`aside a[href="${target.href}"]`).first();
        await link.click();
        await page.waitForURL(`**${target.href}`, { timeout: 10000 });

        // Verify content area is NOT blank and contains expected heading (with web-first auto-retry)
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('main')).toContainText(target.expectedHeading, { ignoreCase: true, timeout: 5000 });
      }
    }

    // 2. Test ADMIN Navigation (Overview <-> Live Monitor <-> Audit <-> Exams <-> Analytics <-> Simulator)
    await loginAs(page, 'admin@proctoriq.io');

    const adminRoutes = [
      { href: '/admin', expectedHeading: 'Overview' },
      { href: '/proctor', expectedHeading: 'Live Telemetry Grid' },
      { href: '/proctor/audit', expectedHeading: 'Adjudication' },
      { href: '/admin/exams', expectedHeading: 'Exam' },
      { href: '/admin/analytics', expectedHeading: 'Telemetry' },
      { href: '/admin/simulator', expectedHeading: 'Simulator' },
    ];

    // Execute 3 full continuous cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      for (const target of adminRoutes) {
        const link = page.locator(`aside a[href="${target.href}"]`).first();
        await link.click();
        await page.waitForURL(`**${target.href}`, { timeout: 10000 });

        // Verify content area is NOT blank and contains expected heading (with web-first auto-retry)
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('main')).toContainText(target.expectedHeading, { ignoreCase: true, timeout: 5000 });
      }
    }

    // 3. Test STUDENT Navigation (Exams & Portal <-> UI Styleguide)
    await loginAs(page, 'student@proctoriq.io');

    const studentRoutes = [
      { href: '/student', expectedHeading: 'Candidate Examination Console' },
      { href: '/styleguide', expectedHeading: 'UI Component Styleguide' },
    ];

    // Execute 3 full continuous cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      for (const target of studentRoutes) {
        const link = page.locator(`aside a[href="${target.href}"]`).first();
        await link.click();
        await page.waitForURL(`**${target.href}`, { timeout: 10000 });

        // Verify content area is NOT blank and contains expected heading (with web-first auto-retry)
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('main')).toContainText(target.expectedHeading, { ignoreCase: true, timeout: 5000 });
      }
    }

    // Zero unexpected console errors across all cycles
    expect(consoleErrors).toEqual([]);
  });
});
