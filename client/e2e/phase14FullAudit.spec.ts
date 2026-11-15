import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../docs/phase14-screenshots');

test.describe('Phase 14: Comprehensive Verification & Audit', () => {
  test.setTimeout(240000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function setTheme(page: any, theme: 'dark' | 'light') {
    await page.evaluate((t: string) => {
      localStorage.setItem('proctoriq-theme', t);
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }, theme);
    await page.waitForTimeout(300);
  }

  // --------------------------------------------------------------------------
  // 1. "/" shows the auth screen for logged-out users
  // --------------------------------------------------------------------------
  test('1. "/" shows the auth screen for logged-out users', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify Auth Card and Sign-in elements are visible
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Authenticate & Enter Console/i })).toBeVisible();

    // Verify Tab Switch to Register works on "/"
    const registerTab = page.getByRole('button', { name: /Create account/i });
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
      const signinTab = page.getByRole('button', { name: /Sign in/i }).first();
      await signinTab.click();
      await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // 2. Login (3 roles) lands on /home
  // --------------------------------------------------------------------------
  test('2. Login (3 roles) lands on /home', async ({ page }) => {
    const roles = [
      { role: 'ADMIN', email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
      { role: 'PROCTOR', email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' },
      { role: 'STUDENT', email: 'student@proctoriq.io', password: 'ProctorIQ#2026' },
    ];

    for (const cred of roles) {
      await page.goto('/?tab=signin');
      await page.evaluate(() => localStorage.clear());
      await page.goto('/?tab=signin');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', cred.email);
      await page.fill('input[type="password"]', cred.password);

      await Promise.all([
        page.waitForResponse(
          (res: any) => res.url().includes('/api/auth/login') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.click('button:has-text("Authenticate & Enter Console")'),
      ]);

      await page.waitForURL('**/home', { timeout: 15000 });
      expect(page.url()).toContain('/home');
      await expect(page.getByRole('heading', { level: 1, name: /Mission Control for/i })).toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // 3. Home is first under CORE
  // --------------------------------------------------------------------------
  test('3. Home is first under CORE', async ({ page }) => {
    // Log in as Admin to inspect sidebar
    await page.goto('/?tab=signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?tab=signin');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await Promise.all([
      page.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.status() === 200),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);
    await page.waitForURL('**/home');

    // Sidebar CORE Section
    const coreHeader = page.locator('text=CORE').first();
    await expect(coreHeader).toBeVisible();

    // Check first navigation link under CORE is Home
    const coreNavContainer = coreHeader.locator('..');
    const firstCoreLink = coreNavContainer.locator('a').first();
    await expect(firstCoreLink).toBeVisible();
    await expect(firstCoreLink).toHaveAttribute('href', '/home');
    await expect(firstCoreLink).toContainText('Home');
  });

  // --------------------------------------------------------------------------
  // 4. The 7/30 day toggle changes the number of points on the line chart
  // --------------------------------------------------------------------------
  test('4. The 7/30 day toggle changes the number of points on the line chart', async ({ page }) => {
    await page.goto('/?tab=signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?tab=signin');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await Promise.all([
      page.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.status() === 200),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const telemetryCard = page.locator('div[aria-label="Violations telemetry timeline area chart"]');
    await expect(telemetryCard).toBeVisible();

    const btn7Days = telemetryCard.getByRole('button', { name: '7 Days', exact: true });
    const btn30Days = telemetryCard.getByRole('button', { name: '30 Days', exact: true });

    // 7 Days view check
    await btn7Days.click();
    await page.waitForTimeout(600);
    const dots7 = await telemetryCard.locator('.recharts-area-dots circle, .recharts-line-dots circle, path.recharts-curve').count();
    expect(dots7).toBeGreaterThan(0);

    // Save screenshot for 7-day view
    await telemetryCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-4-violations-7days.png'),
    });

    // 30 Days view check
    const requestPromise30 = page.waitForResponse(
      (res: any) => res.url().includes('days=30') && res.status() === 200
    );
    await btn30Days.click();
    await requestPromise30;

    const chartContainer = telemetryCard.locator('[data-testid="violations-timeline-chart-container"]');
    await expect(chartContainer).toHaveAttribute('data-points-count', '30');

    await page.waitForTimeout(600);

    // Save screenshot for 30-day view
    await telemetryCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-5-violations-30days.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 5. The skeleton demo switches through all 4 states
  // --------------------------------------------------------------------------
  test('5. The skeleton demo switches through all 4 states', async ({ page }) => {
    await page.goto('/?tab=signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?tab=signin');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await Promise.all([
      page.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.status() === 200),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);

    await page.goto('/styleguide/loading-empty');
    await page.waitForLoadState('domcontentloaded');

    const stateMachineDemo = page.locator('#interactive-state-machine');
    await expect(stateMachineDemo).toBeVisible();

    const btnLoading = stateMachineDemo.getByRole('button', { name: /Loading/i }).first();
    const btnLoaded = stateMachineDemo.getByRole('button', { name: /Loaded/i }).first();
    const btnEmpty = stateMachineDemo.getByRole('button', { name: /Empty/i }).first();
    const btnError = stateMachineDemo.getByRole('button', { name: /Error/i }).first();

    // 1. Loading state
    await btnLoading.click();
    await page.waitForTimeout(300);
    await expect(stateMachineDemo.locator('.animate-pulse, [role="status"]').first()).toBeVisible();

    // 2. Loaded state
    await btnLoaded.click();
    await page.waitForTimeout(300);
    await expect(stateMachineDemo.getByText('Alex Rivera')).toBeVisible();

    // 3. Empty state
    await btnEmpty.click();
    await page.waitForTimeout(300);
    await expect(stateMachineDemo.getByText('No Active Violations')).toBeVisible();

    // 4. Error state
    await btnError.click();
    await page.waitForTimeout(300);
    await expect(stateMachineDemo.getByText('Telemetry Synchronization Failed')).toBeVisible();
    await expect(stateMachineDemo.getByRole('button', { name: /Retry Request/i })).toBeVisible();

    // Save screenshot of the skeleton demo
    await stateMachineDemo.screenshot({
      path: path.join(screenshotDir, 'screenshot-2-skeleton-state-machine.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 6. Donut hover updates the center label
  // --------------------------------------------------------------------------
  test('6. Donut hover updates the center label', async ({ page }) => {
    await page.goto('/?tab=signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?tab=signin');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await Promise.all([
      page.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.status() === 200),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const donutCard = page.locator('div[aria-label="Violation categories distribution chart"]');
    await expect(donutCard).toBeVisible();

    // Default center label
    const alertsCaption = donutCard.getByText('ALERTS', { exact: true });
    await expect(alertsCaption).toBeVisible();

    // Legend hover updates center label
    const legendList = donutCard.locator('[role="list"][aria-label="Violation categories breakdown"]');
    await expect(legendList).toBeVisible();

    const firstLegendBtn = legendList.locator('button').first();
    await expect(firstLegendBtn).toBeVisible();
    const firstLegendLabel = (await firstLegendBtn.locator('span.truncate').innerText()).trim();

    await firstLegendBtn.hover();
    await page.waitForTimeout(300);

    await expect(donutCard.getByText(firstLegendLabel).first()).toBeVisible();
    await expect(alertsCaption).not.toBeVisible();

    // Save screenshot of donut hover
    await donutCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-3-donut-hover.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 7. Check every changed screen in dark and light at 1440, 1024 and 390px
  // --------------------------------------------------------------------------
  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '1024', width: 1024, height: 768 },
    { name: '390', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    for (const mode of ['dark', 'light'] as const) {
      test(`Viewports & Themes (${mode} @ ${vp.name}px): Zero console errors across changed screens`, async ({
        page,
      }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) {
            consoleErrors.push(msg.text());
          }
        });
        page.on('pageerror', (err) => {
          consoleErrors.push(err.message || String(err));
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Screen 1: Auth screen (/)
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await setTheme(page, mode);
        await page.waitForTimeout(400);

        await page.screenshot({
          path: path.join(screenshotDir, `auth_${vp.name}px_${mode}.png`),
          fullPage: vp.width <= 768,
        });

        if (vp.name === '1440' && mode === 'dark') {
          await page.screenshot({
            path: path.join(screenshotDir, 'screenshot-1-auth-entry.png'),
          });
        }

        // Log in as Admin to capture internal screens
        await page.fill('input[type="email"]', 'admin@proctoriq.io');
        await page.fill('input[type="password"]', 'ProctorIQ#2026');
        await Promise.all([
          page.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.status() === 200),
          page.click('button:has-text("Authenticate & Enter Console")'),
        ]);
        await page.waitForURL('**/home');

        // Screen 2: /home
        await setTheme(page, mode);
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(screenshotDir, `home_${vp.name}px_${mode}.png`),
          fullPage: vp.width <= 768,
        });

        // Screen 3: /admin (All Charts & Overview)
        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');
        await setTheme(page, mode);
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(screenshotDir, `admin_overview_${vp.name}px_${mode}.png`),
          fullPage: vp.width <= 768,
        });

        // Specific charts on 1440px dark: Screenshots 6 and 7
        if (vp.name === '1440' && mode === 'dark') {
          const integrityCard = page.locator('div[aria-label="Integrity status split per assessment stacked bar chart"]');
          if (await integrityCard.isVisible()) {
            await integrityCard.screenshot({
              path: path.join(screenshotDir, 'screenshot-6-integrity-split.png'),
            });
          }

          const histogramCard = page.locator('div[aria-label="Candidate trust score distribution histogram"]');
          if (await histogramCard.isVisible()) {
            await histogramCard.screenshot({
              path: path.join(screenshotDir, 'screenshot-7-trust-score-histogram.png'),
            });
          }
        }

        // Screen 4: /styleguide/loading-empty
        await page.goto('/styleguide/loading-empty');
        await page.waitForLoadState('domcontentloaded');
        await setTheme(page, mode);
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(screenshotDir, `styleguide_loading_empty_${vp.name}px_${mode}.png`),
          fullPage: vp.width <= 768,
        });

        expect(consoleErrors).toEqual([]);
      });
    }
  }
});
