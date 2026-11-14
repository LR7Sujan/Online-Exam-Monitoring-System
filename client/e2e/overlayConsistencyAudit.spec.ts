import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/qa-screenshots');

test.describe('Phase 13: Overlay Consistency, Solid Backgrounds & Z-Index Safety (Screenshots 6 & 7)', () => {
  test.setTimeout(120000);

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
    await page.waitForTimeout(400);
  }

  // --------------------------------------------------------------------------
  // 1. Profile Dropdown: Solid Opaque Background, 40px Items, Escape & Backdrop
  // --------------------------------------------------------------------------
  test('Profile dropdown renders solid opaque background, 40px items, and segments without bleed-through', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'student@proctoriq.io');

    // Navigate to student results page (where TRANSACTION EVALUATION heading exists)
    await page.goto('/student/results/13');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Click user account menu button in header
    const userMenuBtn = page.locator('header button[aria-label="User account menu"]');
    await expect(userMenuBtn).toBeVisible();
    await userMenuBtn.click();
    await page.waitForTimeout(300);

    // Profile dropdown dialog is open
    const profilePanel = page.locator('div[role="dialog"][aria-label="User account menu"]');
    await expect(profilePanel).toBeVisible();

    // Verify solid background token and shadow
    await expect(profilePanel).toHaveClass(/bg-surface/);
    await expect(profilePanel).toHaveClass(/shadow-2xl/);
    await expect(profilePanel).toHaveClass(/z-50/);

    // Verify user info details
    await expect(profilePanel).toContainText('Aarav Chen');
    await expect(profilePanel).toContainText('student@proctoriq.io');
    await expect(profilePanel).toContainText('STUDENT');
    await expect(profilePanel).toContainText('ID: #');

    // Verify 40px navigation items (h-10)
    const profileItem = profilePanel.getByRole('button', { name: /operator profile/i });
    const settingsItem = profilePanel.getByRole('button', { name: /system preferences/i });
    const themeItem = profilePanel.getByRole('button', { name: /interface theme/i });
    const signoutBtn = profilePanel.getByRole('button', { name: /sign out/i });

    await expect(profileItem).toBeVisible();
    await expect(settingsItem).toBeVisible();
    await expect(themeItem).toBeVisible();
    await expect(signoutBtn).toBeVisible();

    const signoutBox = await signoutBtn.boundingBox();
    expect(signoutBox).not.toBeNull();
    if (signoutBox) {
      expect(Math.round(signoutBox.height)).toBeGreaterThanOrEqual(38); // 40px item
    }

    // Take screenshot of solid opaque profile dropdown over Student Results
    await page.screenshot({
      path: path.join(screenshotDir, 'profile_dropdown_solid_overlay_1440px.png'),
    });

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(profilePanel).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 2. Notification Panel: 420px Solid Feed, Segmented Tabs & LiveDot
  // --------------------------------------------------------------------------
  test('Violation Telemetry Feed panel has 420px width, segmented control, and no text overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'proctor@proctoriq.io');

    // Open notification panel via bell button
    const notifBtn = page.locator('header button[aria-label="Notifications"]');
    await expect(notifBtn).toBeVisible();
    await notifBtn.click();
    await page.waitForTimeout(300);

    const feedPanel = page.locator('div[role="dialog"][aria-label="Violation Telemetry Feed"]');
    await expect(feedPanel).toBeVisible();

    // Verify width is 420px on desktop
    const feedBox = await feedPanel.boundingBox();
    expect(feedBox).not.toBeNull();
    if (feedBox) {
      expect(Math.round(feedBox.width)).toBe(420);
    }

    // Verify solid background and z-50
    await expect(feedPanel).toHaveClass(/bg-surface/);
    await expect(feedPanel).toHaveClass(/z-50/);

    // Verify header elements: Title, count chip, and close button
    await expect(feedPanel.getByText('Violation Telemetry Feed')).toBeVisible();
    const closeBtn = feedPanel.locator('button[aria-label="Close notification panel"]');
    await expect(closeBtn).toBeVisible();

    // Verify segmented control tabs
    const allTab = feedPanel.getByRole('button', { name: /^all/i });
    const criticalTab = feedPanel.getByRole('button', { name: /^critical/i });
    const highTab = feedPanel.getByRole('button', { name: /^high/i });
    const medLowTab = feedPanel.getByRole('button', { name: /^med\/low/i });

    await expect(allTab).toBeVisible();
    await expect(criticalTab).toBeVisible();
    await expect(highTab).toBeVisible();
    await expect(medLowTab).toBeVisible();

    // Click Critical tab
    await criticalTab.click();
    await page.waitForTimeout(150);
    await expect(criticalTab).toHaveClass(/bg-brand-gradient/);

    // Verify footer link "View all violations"
    const viewAllLink = feedPanel.getByText('View all violations');
    await expect(viewAllLink).toBeVisible();

    // Take screenshot of notification feed panel
    await page.screenshot({
      path: path.join(screenshotDir, 'violation_telemetry_feed_panel_1440px.png'),
    });

    // Close via close button
    await closeBtn.click();
    await page.waitForTimeout(250);
    await expect(feedPanel).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 3. Mobile Viewport (390px): Full-Width Overlay & Zero Clipping
  // --------------------------------------------------------------------------
  test('Overlays scale responsively at 390px mobile viewport without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'proctor@proctoriq.io');

    // Open notifications on mobile
    const notifBtn = page.locator('header button[aria-label="Notifications"]');
    await notifBtn.click();
    await page.waitForTimeout(300);

    const feedPanel = page.locator('div[role="dialog"][aria-label="Violation Telemetry Feed"]');
    await expect(feedPanel).toBeVisible();

    const feedMobileBox = await feedPanel.boundingBox();
    expect(feedMobileBox).not.toBeNull();
    if (feedMobileBox) {
      // Must not exceed screen width
      expect(feedMobileBox.width).toBeLessThanOrEqual(390);
      expect(feedMobileBox.x).toBeGreaterThanOrEqual(0);
    }

    // Take mobile screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'violation_feed_mobile_390px.png'),
    });

    // Click outside backdrop to dismiss
    const backdrop = page.locator('div.fixed.inset-0.z-40');
    await backdrop.click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(250);
    await expect(feedPanel).not.toBeVisible();
  });
});
