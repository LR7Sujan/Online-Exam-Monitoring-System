import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../docs/phase15-home');

test.describe('Phase 15: /home Page Layout & AppShell Integration', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAsAdmin(page: any, consoleErrors?: string[]) {
    if (consoleErrors) {
      page.on('console', (msg: any) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon.ico')) {
            consoleErrors.push(text);
          }
        }
      });
      page.on('pageerror', (err: any) => {
        consoleErrors.push(err.message || String(err));
      });
    }

    await page.goto('/?tab=signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?tab=signin');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');

    await Promise.all([
      page.waitForResponse(
        (res: any) => res.url().includes('/api/auth/login') && res.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);

    await page.waitForTimeout(300);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
  }

  async function toggleTheme(page: any) {
    const themeBtn = page
      .locator('header')
      .locator(
        'button[title*="theme" i], button:has-text("Theme"), button:has(svg.lucide-moon), button:has(svg.lucide-sun)'
      )
      .first();
    await themeBtn.click();
    await page.waitForTimeout(400);
  }

  test('1. /home removes duplicate nested header, integrates with AppShell, and preserves nav state', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    // 1A. Shell navigation active state & breadcrumb
    const activeNav = page.locator('aside nav a[href="/home"]');
    await expect(activeNav).toBeVisible();
    await expect(activeNav).toHaveClass(/bg-brand/);

    const breadcrumb = page.locator('header').getByText('Home', { exact: true });
    await expect(breadcrumb).toBeVisible();

    await expect(page).toHaveTitle('Home | ProctorIQ');

    // 1B. Verify duplicate nested header is removed from main content
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // No nested <header> inside main
    const nestedHeaders = mainContent.locator('header');
    expect(await nestedHeaders.count()).toBe(0);

    // No duplicate user chip inside main (the top header already displays Dr. Elena Vance)
    const duplicateUserChips = mainContent.locator('div').filter({ hasText: /^Dr\. Elena Vance\s*ADMIN$/ });
    expect(await duplicateUserChips.count()).toBe(0);

    // No duplicate brand logo inside main
    const duplicateLogos = mainContent.locator('a[href="/home"]');
    expect(await duplicateLogos.count()).toBe(0);

    expect(consoleErrors).toEqual([]);
  });

  test('2. First screen at 1440x900 fits hero, CTAs, stat badges, and telemetry card without scrolling', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Verify Hero elements are present
    const headline = mainContent.locator('h1').filter({ hasText: /Mission Control for ProctorIQ/i });
    await expect(headline).toBeVisible();

    const openDashboardBtn = mainContent.getByRole('button', { name: /Open my dashboard/i }).first();
    await expect(openDashboardBtn).toBeVisible();

    const styleguideLink = mainContent.getByRole('link', { name: /Explore UI Styleguide/i }).first();
    await expect(styleguideLink).toBeVisible();

    // Stat Badges
    const acidBadge = mainContent.getByText('ACID', { exact: true }).first();
    await expect(acidBadge).toBeVisible();
    const triggersBadge = mainContent.getByText('Triggers', { exact: true }).first();
    await expect(triggersBadge).toBeVisible();
    const latencyBadge = mainContent.getByText('<20ms', { exact: true }).first();
    await expect(latencyBadge).toBeVisible();

    // Telemetry Card
    const telemetryCard = mainContent.getByText('Live Telemetry Cluster').first();
    await expect(telemetryCard).toBeVisible();

    // Check vertical bounds: stat badges and CTAs must be above the 900px fold without scrolling
    const acidBox = await acidBadge.boundingBox();
    expect(acidBox).not.toBeNull();
    expect(acidBox!.y + acidBox!.height).toBeLessThan(880);

    const ctaBox = await openDashboardBtn.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThan(800);

    const telemetryBox = await telemetryCard.boundingBox();
    expect(telemetryBox).not.toBeNull();
    expect(telemetryBox!.y).toBeLessThan(400);

    // Save screenshot of 1440x900 first screen
    await page.screenshot({
      path: path.join(screenshotDir, 'home_first_screen_1440x900.png'),
    });

    // Save full page dark after screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'home_after_1440px_dark.png'),
      fullPage: true,
    });

    // Toggle theme to light mode and capture
    await toggleTheme(page);
    await page.screenshot({
      path: path.join(screenshotDir, 'home_after_1440px_light.png'),
      fullPage: true,
    });
    await toggleTheme(page); // restore dark

    expect(consoleErrors).toEqual([]);
  });

  test('3. Text fixes: Examinees active caption, SELECT ... FOR UPDATE wrap, and casing', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // 3A. Typo fix: "100% active", NOT "100% actived"
    await expect(mainContent.getByText('● 100% active')).toBeVisible();
    await expect(mainContent.getByText(/100% actived/i)).toHaveCount(0);

    // 3B. Stat row label: "SELECT ... FOR UPDATE" is complete and visible
    const forUpdateText = mainContent.getByText('SELECT ... FOR UPDATE', { exact: true });
    await expect(forUpdateText).toBeVisible();

    // 3C. Status pill casing: "DBMS-Enforced Zero-Trust Exam Core"
    await expect(mainContent.getByText('DBMS-Enforced Zero-Trust Exam Core')).toBeVisible();

    // 3D. Footer text casing: "All systems nominal • MySQL 8.0 • WSS cluster"
    await expect(mainContent.getByText(/All systems nominal • MySQL 8\.0 • WSS cluster/i)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('4. Responsive viewports: 1280, 1024, 768, and 390px with zero horizontal scroll', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const viewports = [
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await loginAsAdmin(page, consoleErrors);

      // Verify no horizontal overflow on window or main
      const hasHorizontalOverflow = await page.evaluate(() => {
        const docElem = document.documentElement;
        const body = document.body;
        const main = document.querySelector('main');
        const docOverflow = docElem.scrollWidth > docElem.clientWidth + 2;
        const bodyOverflow = body.scrollWidth > body.clientWidth + 2;
        const mainOverflow = main ? main.scrollWidth > main.clientWidth + 2 : false;
        return docOverflow || bodyOverflow || mainOverflow;
      });
      expect(hasHorizontalOverflow).toBe(false);

      if (vp.width === 1024) {
        await page.screenshot({
          path: path.join(screenshotDir, 'home_after_1024px_dark.png'),
          fullPage: true,
        });
      }

      if (vp.width === 390) {
        await page.screenshot({
          path: path.join(screenshotDir, 'home_after_390px_dark.png'),
          fullPage: true,
        });
      }
    }

    expect(consoleErrors).toEqual([]);
  });
});
