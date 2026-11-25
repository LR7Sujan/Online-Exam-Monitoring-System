import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/phase19-screenshots');

async function loginAsAdmin(page: any) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@proctoriq.io');
  await page.fill('input[type="password"]', 'ProctorIQ#2026');
  await page.click('button:has-text("Authenticate & Enter Console")');
  await page.waitForURL(/\/home|\/admin/, { timeout: 15000 });
}

test.describe('Styleguide Loading & Empty States Verification', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test('Run 1: Dark Theme Full Interactive & Standalone Verification', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to /styleguide/loading-empty-states
    await page.goto('/styleguide/loading-empty-states');
    await page.waitForLoadState('networkidle');

    // Ensure dark theme is active
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    });

    const interactiveCard = page.locator('#interactive-state-machine');
    await expect(interactiveCard).toBeVisible();

    // 1. Initial State: LOADED by default with 5 rows
    const rows = page.locator('[data-testid="interactive-row"]');
    await expect(rows).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      const row = rows.nth(i);
      await expect(row).toBeVisible();
      const box = await row.boundingBox();
      expect(box?.height).toBeGreaterThan(40);
      const opacity = await row.evaluate((el) => window.getComputedStyle(el).opacity);
      expect(Number(opacity)).toBe(1);
    }

    await interactiveCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'interactive-loaded-dark.png'),
    });

    // 2. Click "Loading" -> skeletons appear, wait <= 2.5s, auto-resolves to loaded rows
    await page.locator('[data-testid="btn-state-loading"]').click();
    const skeletons = page.locator('[data-testid="interactive-skeleton"]');
    await expect(skeletons).toHaveCount(5);

    await interactiveCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'interactive-loading-dark.png'),
    });

    // Auto-resolves after 1.5s
    await expect(rows).toHaveCount(5, { timeout: 3000 });
    await expect(skeletons).toHaveCount(0);

    // 3. Click "Empty" -> Empty State with Refresh button
    await page.locator('[data-testid="btn-state-empty"]').click();
    await expect(page.locator('text=No Active Violations')).toBeVisible();

    await interactiveCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'interactive-empty-dark.png'),
    });

    // Click Refresh on empty card -> Loading 1s -> Loaded
    await page.locator('#interactive-state-machine button:has-text("Refresh")').click();
    await expect(skeletons).toHaveCount(5);
    await expect(rows).toHaveCount(5, { timeout: 2500 });

    // 4. Click "Error" -> Error State with Retry button
    await page.locator('[data-testid="btn-state-error"]').click();
    await expect(page.locator('text=Telemetry Synchronization Failed')).toBeVisible();

    await interactiveCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'interactive-error-dark.png'),
    });

    // Click Retry on error card -> Loading 1s -> Loaded
    await page.locator('#interactive-state-machine button:has-text("Retry")').click();
    await expect(skeletons).toHaveCount(5);
    await expect(rows).toHaveCount(5, { timeout: 2500 });

    // 5. Standalone Skeleton Loaders Section
    const standaloneCard = page.locator('#standalone-skeletons');
    await expect(standaloneCard).toBeVisible();

    // Default tab: Content
    await expect(page.locator('[data-testid="standalone-content-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="standalone-skeleton-view"]')).toHaveCount(0);
    await expect(page.locator('text=SYS-310: Distributed Systems')).toBeVisible();
    await expect(page.locator('text=Elena Kaur')).toBeVisible();
    await expect(page.locator('text=98% Trust')).toBeVisible();

    await standaloneCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'standalone-content-dark.png'),
    });

    // Click "Skeleton" tab
    await page.locator('[data-testid="tab-skeleton"]').click();
    await expect(page.locator('[data-testid="standalone-skeleton-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="standalone-content-view"]')).toHaveCount(0);

    await standaloneCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'standalone-skeleton-dark.png'),
    });

    // Click "Replay load (1s)"
    await page.locator('[data-testid="btn-replay-load"]').click();
    await expect(page.locator('[data-testid="standalone-skeleton-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="standalone-content-view"]')).toBeVisible({ timeout: 2500 });
  });

  test('Run 2: Light Theme Full Interactive & Standalone Verification', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/styleguide/loading-empty-states');
    await page.waitForLoadState('networkidle');

    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    const interactiveCard = page.locator('#interactive-state-machine');
    await expect(interactiveCard).toBeVisible();

    // Verify 5 loaded rows in light theme
    const rows = page.locator('[data-testid="interactive-row"]');
    await expect(rows).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const row = rows.nth(i);
      await expect(row).toBeVisible();
      const box = await row.boundingBox();
      expect(box?.height).toBeGreaterThan(40);
      const opacity = await row.evaluate((el) => window.getComputedStyle(el).opacity);
      expect(Number(opacity)).toBe(1);
    }

    await interactiveCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'interactive-loaded-light.png'),
    });

    // Click Loading -> wait -> Loaded
    await page.locator('[data-testid="btn-state-loading"]').click();
    const skeletons = page.locator('[data-testid="interactive-skeleton"]');
    await expect(skeletons).toHaveCount(5);

    await interactiveCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'interactive-loading-light.png'),
    });

    await expect(rows).toHaveCount(5, { timeout: 3000 });

    // Standalone in Light Theme
    const standaloneCard = page.locator('#standalone-skeletons');
    await expect(page.locator('[data-testid="standalone-content-view"]')).toBeVisible();

    await standaloneCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'standalone-content-light.png'),
    });

    await page.locator('[data-testid="tab-skeleton"]').click();
    await expect(page.locator('[data-testid="standalone-skeleton-view"]')).toBeVisible();

    await standaloneCard.screenshot({
      path: path.join(SCREENSHOT_DIR, 'standalone-skeleton-light.png'),
    });

    await page.locator('[data-testid="btn-replay-load"]').click();
    await expect(page.locator('[data-testid="standalone-content-view"]')).toBeVisible({ timeout: 2500 });
  });

  test('Run 3: 4x CPU Throttling Robustness Verification', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/styleguide/loading-empty-states');
    await page.waitForLoadState('networkidle');

    // Emulate 4x CPU throttling
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const interactiveCard = page.locator('#interactive-state-machine');
    await expect(interactiveCard).toBeVisible();

    // Verify rows load and have opacity 1 and height > 40 even under 4x CPU throttling
    const rows = page.locator('[data-testid="interactive-row"]');
    await expect(rows).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const row = rows.nth(i);
      const box = await row.boundingBox();
      expect(box?.height).toBeGreaterThan(40);
      const opacity = await row.evaluate((el) => window.getComputedStyle(el).opacity);
      expect(Number(opacity)).toBe(1);
    }

    // Trigger auto-resolve under throttling
    await page.locator('[data-testid="btn-state-loading"]').click();
    const skeletons = page.locator('[data-testid="interactive-skeleton"]');
    await expect(skeletons).toHaveCount(5);

    // Allow margin for 4x CPU throttling (up to 4.5s)
    await expect(rows).toHaveCount(5, { timeout: 4500 });
    await expect(skeletons).toHaveCount(0);

    // Verify Empty -> Refresh -> Loading -> Loaded under throttling
    await page.locator('[data-testid="btn-state-empty"]').click();
    await expect(page.locator('text=No Active Violations')).toBeVisible();
    await page.locator('#interactive-state-machine button:has-text("Refresh")').click();
    await expect(rows).toHaveCount(5, { timeout: 4500 });

    // Verify Standalone Replay under throttling
    await page.locator('[data-testid="btn-replay-load"]').click();
    await expect(page.locator('[data-testid="standalone-content-view"]')).toBeVisible({ timeout: 4500 });

    // Reset CPU throttling
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
