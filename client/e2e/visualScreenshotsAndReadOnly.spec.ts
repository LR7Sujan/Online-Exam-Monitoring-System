import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/phase18-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Target the real app running on 5173
const REAL_APP_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];

test.describe('Real App Read-Only Audit & Phase 18 Screenshots', () => {
  // Use separate browser contexts so we can set viewport and theme cleanly
  for (const vp of VIEWPORTS) {
    for (const theme of ['dark', 'light'] as const) {
      test(`Audit & capture at ${vp.name}px in ${theme} mode`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('favicon.ico') && !text.includes('net::ERR_')) {
              consoleErrors.push(text);
            }
          }
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Helper to switch theme
        const applyTheme = async () => {
          await page.evaluate((t) => {
            document.documentElement.classList.remove('dark', 'light');
            document.documentElement.classList.add(t);
            document.documentElement.setAttribute('data-theme', t);
            localStorage.setItem('proctoriq_theme', t);
          }, theme);
          await page.waitForTimeout(250);
        };

        // 1. Landing Page (Phase 16.1 blank-page check)
        await page.goto(REAL_APP_URL + '/');
        await page.waitForLoadState('domcontentloaded');
        await applyTheme();
        const rootContent = await page.locator('#root').innerHTML();
        expect(rootContent.trim().length).toBeGreaterThan(50);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `landing-${theme}-${vp.name}.png`),
        });

        // 2. Login Page
        await page.goto(REAL_APP_URL + '/login');
        await page.waitForLoadState('domcontentloaded');
        await applyTheme();
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `login-${theme}-${vp.name}.png`),
        });

        // Login as Admin to inspect live monitor and catalog
        await page.fill('input[type="email"]', 'admin@proctoriq.io');
        await page.fill('input[type="password"]', 'ProctorIQ#2026');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/home**', { timeout: 10000 });
        await applyTheme();

        // 3. Admin Catalog
        await page.goto(REAL_APP_URL + '/admin');
        await page.waitForLoadState('networkidle');
        await applyTheme();
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `admin-catalog-${theme}-${vp.name}.png`),
        });

        // 4. Live Monitor
        await page.goto(REAL_APP_URL + '/proctor');
        await page.waitForLoadState('networkidle');
        await applyTheme();
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `proctor-monitor-${theme}-${vp.name}.png`),
        });

        // Check TrustRing element exists and has proper geometry
        const rings = page.locator('svg[role="progressbar"]');
        if (await rings.count() > 0) {
          const firstRing = rings.first();
          await expect(firstRing).toBeVisible();
        }

        // 5. Drawer inspection & Modal Viewport Test (Phase 17.1)
        const inspectBtn = page.locator('text=Inspect').first();
        if (await inspectBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await inspectBtn.click();
          const drawer = page.locator('[role="dialog"]');
          await expect(drawer).toBeVisible({ timeout: 3000 });
          await applyTheme();

          // Modal Viewport Audit: ensure drawer is within viewport bounds
          const box = await drawer.boundingBox();
          expect(box).not.toBeNull();
          if (box) {
            expect(box.x).toBeGreaterThanOrEqual(-5);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.width).toBeLessThanOrEqual(vp.width + 10);
            expect(box.height).toBeLessThanOrEqual(vp.height + 10);
          }

          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `proctor-drawer-${theme}-${vp.name}.png`),
          });

          // Close drawer
          const closeBtn = page.locator('button[aria-label="Close drawer"]').first();
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(200);
          }
        }

        // 6. Student Dashboard
        await page.goto(REAL_APP_URL + '/student');
        await page.waitForLoadState('networkidle');
        await applyTheme();
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `student-dashboard-${theme}-${vp.name}.png`),
        });

        // Assert 0 console errors
        expect(consoleErrors).toEqual([]);
      });
    }
  }
});
