import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../docs/phase15-screenshots');

test.describe('Phase 15 Screenshots and Theme/Console Validation', () => {
  test.setTimeout(180000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAsAdmin(page: any) {
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

    await page.waitForTimeout(400);
  }

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

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '1024', width: 1024, height: 768 },
    { name: '390', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    for (const mode of ['dark', 'light'] as const) {
      test(`Check /home in ${mode} mode at ${vp.name}px with 0 console errors`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('favicon.ico')) {
              consoleErrors.push(text);
            }
          }
        });
        page.on('pageerror', (err) => {
          consoleErrors.push(err.message || String(err));
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginAsAdmin(page);

        await page.goto('/home');
        await page.waitForLoadState('domcontentloaded');
        await setTheme(page, mode);
        await page.waitForTimeout(500);

        // Verify page headline is rendered
        await expect(page.getByRole('heading', { level: 1, name: /Mission Control for/i })).toBeVisible();

        // Capture screenshot
        const screenshotPath = path.join(screenshotDir, `home_${vp.name}px_${mode}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: vp.width <= 768 });

        // Assert zero console errors
        expect(consoleErrors, `Console errors detected on /home (${vp.name}px, ${mode}): ${consoleErrors.join(', ')}`).toEqual([]);
      });

      test(`Check /admin/simulator in ${mode} mode at ${vp.name}px with 0 console errors`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('favicon.ico')) {
              consoleErrors.push(text);
            }
          }
        });
        page.on('pageerror', (err) => {
          consoleErrors.push(err.message || String(err));
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginAsAdmin(page);

        await page.goto('/admin/simulator');
        await page.waitForLoadState('domcontentloaded');
        await setTheme(page, mode);
        await page.waitForTimeout(500);

        // Verify simulator heading and Reset button are rendered
        await expect(page.getByRole('heading', { level: 1, name: /Candidate Swarm Demo Simulator/i })).toBeVisible();
        await expect(page.getByTestId('simulator-reset-btn')).toBeVisible();

        // Capture screenshot
        const screenshotPath = path.join(screenshotDir, `simulator_${vp.name}px_${mode}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: vp.width <= 768 });

        // Assert zero console errors
        expect(consoleErrors, `Console errors detected on /admin/simulator (${vp.name}px, ${mode}): ${consoleErrors.join(', ')}`).toEqual([]);
      });
    }
  }
});
