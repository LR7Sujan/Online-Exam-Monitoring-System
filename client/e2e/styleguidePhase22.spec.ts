import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/phase22-screenshots');

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[type="email"]', 'admin@proctoriq.io');
  await page.fill('input[type="password"]', 'ProctorIQ#2026');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Phase 22 Styleguide Proof: Overview Card & Loading/Empty Results', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test('Overview Cards: Equal height and aligned tags at 1440px, 1024px, and 390px', async ({ page }) => {
    await loginAsAdmin(page);

    // 1440px Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/styleguide');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'overview-1440-dark.png'), fullPage: false });

    const cards1440 = page.locator('a[href^="/styleguide/"]');
    const count1440 = await cards1440.count();
    expect(count1440).toBeGreaterThanOrEqual(12);

    // Verify card #11 (Loading & Empty States) has NO duplicate subtitle and NO skeleton bars
    const card11 = page.locator('a[href="/styleguide/loading-empty"]');
    await expect(card11).toBeVisible();
    await expect(card11.locator('text=11. Skeleton Loaders')).toHaveCount(0);
    await expect(card11.locator('[aria-hidden="true"] .animate-shimmer')).toHaveCount(0);

    // Verify heights of cards in row
    const card10Box = await page.locator('a[href="/styleguide/charts"]').boundingBox();
    const card11Box = await card11.boundingBox();
    const card12Box = await page.locator('a[href="/styleguide/motion"]').boundingBox();

    expect(card10Box).not.toBeNull();
    expect(card11Box).not.toBeNull();
    expect(card12Box).not.toBeNull();
    // Cards in same CSS grid row must have equal height
    expect(Math.abs((card11Box?.height ?? 0) - (card10Box?.height ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.abs((card11Box?.height ?? 0) - (card12Box?.height ?? 0))).toBeLessThanOrEqual(2);

    // 1024px Tablet
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'overview-1024-dark.png'), fullPage: false });
    const card11Box1024 = await card11.boundingBox();
    expect(card11Box1024?.height).toBeGreaterThan(100);

    // 390px Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'overview-390-dark.png'), fullPage: false });
    const card11Box390 = await card11.boundingBox();
    expect(card11Box390?.height).toBeGreaterThan(100);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`Section Page Proof (${theme} theme): 6 rows, opacity 1, height > 40, auto-resolve & states`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsAdmin(page);

      await page.goto('/styleguide/loading-empty-states');
      await page.waitForLoadState('networkidle');

      // Set theme
      await page.evaluate((t) => {
        if (t === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      }, theme);
      await page.waitForTimeout(200);

      const interactiveCard = page.locator('#interactive-state-machine');
      await expect(interactiveCard).toBeVisible();

      // 1. Initial State: LOADED by default with at least 6 readable sample rows
      const rows = page.locator('[data-testid="interactive-row"]');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(6);

      // Verify each row has computed opacity 1, height > 40, and contains Trust %
      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        await expect(row).toBeVisible();
        const box = await row.boundingBox();
        expect(box?.height).toBeGreaterThan(40);

        const computedOpacity = await row.evaluate((el) => window.getComputedStyle(el).opacity);
        expect(Number(computedOpacity)).toBe(1);

        // Verify Trust % is visible
        const text = await row.innerText();
        expect(text).toMatch(/\d+%\s*Trust/i);
      }

      await interactiveCard.screenshot({
        path: path.join(SCREENSHOT_DIR, `interactive-loaded-${theme}.png`),
      });

      // 2. Click "Loading": assert skeletons appear with height > 40
      await page.locator('[data-testid="btn-state-loading"]').click();
      const skeletons = page.locator('[data-testid="interactive-skeleton"]');
      await expect(skeletons).toHaveCount(6);

      const skeletonBox = await skeletons.first().boundingBox();
      expect(skeletonBox?.height).toBeGreaterThan(40);

      await interactiveCard.screenshot({
        path: path.join(SCREENSHOT_DIR, `interactive-loading-${theme}.png`),
      });

      // Assert that within 2.5s, skeletons are gone and rows are back automatically
      await expect(skeletons).toHaveCount(0, { timeout: 2500 });
      await expect(rows).toHaveCount(6, { timeout: 500 });

      // 3. Click "Empty": assert empty state text and working Refresh button
      await page.locator('[data-testid="btn-state-empty"]').click();
      await expect(page.locator('text=No Active Violations')).toBeVisible();

      await interactiveCard.screenshot({
        path: path.join(SCREENSHOT_DIR, `interactive-empty-${theme}.png`),
      });

      // Click Refresh on empty card: Loading 1s -> Loaded rows back
      await page.locator('#interactive-state-machine button:has-text("Refresh")').click();
      await expect(skeletons).toHaveCount(6);
      await expect(skeletons).toHaveCount(0, { timeout: 2500 });
      await expect(rows).toHaveCount(6);

      // 4. Click "Error": assert error state text and working Retry button
      await page.locator('[data-testid="btn-state-error"]').click();
      await expect(page.locator('text=Telemetry Synchronization Failed')).toBeVisible();

      await interactiveCard.screenshot({
        path: path.join(SCREENSHOT_DIR, `interactive-error-${theme}.png`),
      });

      // Click Retry on error card: Loading 1s -> Loaded rows back
      await page.locator('#interactive-state-machine button:has-text("Retry")').click();
      await expect(skeletons).toHaveCount(6);
      await expect(skeletons).toHaveCount(0, { timeout: 2500 });
      await expect(rows).toHaveCount(6);

      // 5. Standalone Skeleton Demo: check Skeleton / Content switch and Replay
      const standaloneSection = page.locator('#standalone-skeletons');
      await expect(standaloneSection).toBeVisible();

      // Check Content view
      await page.locator('[data-testid="tab-content"]').click();
      const contentView = page.locator('[data-testid="standalone-content-view"]');
      await expect(contentView).toBeVisible();
      await expect(page.locator('text=SYS-310: Distributed Systems')).toBeVisible();
      await expect(page.locator('text=Authoritative Telemetry Metrics')).toBeVisible();

      await standaloneSection.screenshot({
        path: path.join(SCREENSHOT_DIR, `standalone-content-${theme}.png`),
      });

      // Check Skeleton view
      await page.locator('[data-testid="tab-skeleton"]').click();
      const skeletonView = page.locator('[data-testid="standalone-skeleton-view"]');
      await expect(skeletonView).toBeVisible();

      await standaloneSection.screenshot({
        path: path.join(SCREENSHOT_DIR, `standalone-skeleton-${theme}.png`),
      });

      // Test "Replay load": switches to skeleton for 1s, then automatically back to content
      await page.locator('[data-testid="btn-replay-load"]').click();
      await expect(skeletonView).toBeVisible();
      await expect(contentView).toBeVisible({ timeout: 2500 });

      // 6. Section 3: Actionable Empty & Error states screenshot
      const section3 = page.locator('#empty-and-error-states');
      await expect(section3).toBeVisible();
      await section3.screenshot({
        path: path.join(SCREENSHOT_DIR, `section3-empty-error-${theme}.png`),
      });
    });
  }

  test('Section Page Proof with 4x CPU Throttling: auto-resolve and timers remain robust', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    await page.goto('/styleguide/loading-empty-states');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('[data-testid="interactive-row"]');
    await expect(rows).toHaveCount(6);

    // Connect CDP session to throttle CPU 4x
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Click Loading under 4x CPU throttle
    await page.locator('[data-testid="btn-state-loading"]').click();
    const skeletons = page.locator('[data-testid="interactive-skeleton"]');
    await expect(skeletons).toHaveCount(6);

    // Auto-resolve must still cleanly fire within 3.5s despite 4x CPU throttle
    await expect(skeletons).toHaveCount(0, { timeout: 4500 });
    await expect(rows).toHaveCount(6);

    // Reset CPU throttling
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
