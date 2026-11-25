import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'phase18-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];

async function captureScreen(
  page: any,
  fileName: string,
  theme: 'dark' | 'light'
) {
  // Set theme attribute on documentElement
  await page.evaluate((t: string) => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('proctoriq_theme', t);
  }, theme);
  await page.waitForTimeout(400);

  const outPath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Saved screenshot: ${fileName}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const consoleErrors: string[] = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      baseURL: 'http://localhost:5173',
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected network noise if any
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(`[${vp.name}px] ${text}`);
        }
      }
    });

    console.log(`\n--- Capturing Viewport: ${vp.name}px ---`);

    // 1. Landing Page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await captureScreen(page, `landing-dark-${vp.name}.png`, 'dark');
    await captureScreen(page, `landing-light-${vp.name}.png`, 'light');

    // 2. Login Page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await captureScreen(page, `login-dark-${vp.name}.png`, 'dark');
    await captureScreen(page, `login-light-${vp.name}.png`, 'light');

    // Login as Admin
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 3. Admin Catalog
    await captureScreen(page, `admin-catalog-dark-${vp.name}.png`, 'dark');
    await captureScreen(page, `admin-catalog-light-${vp.name}.png`, 'light');

    // 4. Live Monitor (Proctor Page)
    await page.goto('/proctor');
    await page.waitForLoadState('networkidle');
    await captureScreen(page, `proctor-monitor-dark-${vp.name}.png`, 'dark');
    await captureScreen(page, `proctor-monitor-light-${vp.name}.png`, 'light');

    // 5. Open Drawer if candidate card exists
    const card = page.locator('[data-testid^="candidate-card-"]').first();
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      await card.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      await captureScreen(page, `proctor-drawer-dark-${vp.name}.png`, 'dark');
      await captureScreen(page, `proctor-drawer-light-${vp.name}.png`, 'light');
      // Close drawer
      const closeBtn = page.locator('button[aria-label="Close drawer"]').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // 6. Student Dashboard
    await page.goto('/student');
    await page.waitForLoadState('networkidle');
    await captureScreen(page, `student-dashboard-dark-${vp.name}.png`, 'dark');
    await captureScreen(page, `student-dashboard-light-${vp.name}.png`, 'light');

    await context.close();
  }

  await browser.close();

  console.log('\n=== CAPTURE SUMMARY ===');
  console.log(`Console Errors encountered: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.log('  ', e));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
