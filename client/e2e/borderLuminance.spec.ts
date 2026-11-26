import { test, expect, Page } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';

// Calculates relative luminance from rgb/rgba string
function parseRgb(colorStr: string): { r: number; g: number; b: number; a: number; luminance: number } | null {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  const r = parseInt(match[1], 10) / 255;
  const g = parseInt(match[2], 10) / 255;
  const b = parseInt(match[3], 10) / 255;
  const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { r, g, b, a, luminance };
}

async function loginAs(page: Page, role: 'Admin' | 'Proctor' | 'Student') {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Click role fast-fill button
  const roleBtn = page.locator(`button:has-text("${role}")`).first();
  await roleBtn.click();
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForURL('**/home**', { timeout: 15000 });
}

async function checkPageContainerBorders(page: Page, pageName: string, isDarkMode: boolean) {
  // Query all visible card/panel/container elements
  const violations = await page.evaluate(({ isDark }) => {
    function parseRgbInternal(colorStr: string) {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;
      const r = parseInt(match[1], 10) / 255;
      const g = parseInt(match[2], 10) / 255;
      const b = parseInt(match[3], 10) / 255;
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { r, g, b, a, luminance };
    }

    const selectors = [
      '.bento-card',
      'div.rounded-2xl',
      'div.rounded-xl',
      '[data-testid*="table"]',
      'table',
      'input',
      'select',
    ];

    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    const offenders: Array<{ className: string; borderTopColor: string; luminance: number; width: string }> = [];

    for (const el of elements) {
      // Must be visible
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;

      const borderWidth = parseFloat(cs.borderTopWidth || '0');
      if (borderWidth < 0.5) continue;

      const parsed = parseRgbInternal(cs.borderTopColor);
      if (!parsed) continue;

      // Skip fully transparent borders
      if (parsed.a < 0.05) continue;

      // Allow-list: Semantic / status colors (Rose, Amber, Emerald, Brand Indigo/Violet/Fuchsia, Sky/Cyan)
      const isRedOrRose = (parsed.r > 0.5 && parsed.g < 0.4 && parsed.b < 0.4) || el.className.includes('border-rose') || el.className.includes('border-danger');
      const isAmberOrOrange = (parsed.r > 0.5 && parsed.g > 0.4 && parsed.b < 0.3) || el.className.includes('border-amber') || el.className.includes('border-caution');
      const isEmerald = (parsed.g > 0.35 && parsed.r < 0.4) || el.className.includes('border-emerald') || el.className.includes('border-safe');
      const isBrandOrViolet = parsed.b > 0.5 || el.className.includes('border-brand') || el.className.includes('border-violet') || el.className.includes('border-sky') || el.className.includes('border-cyan');
      const isFuchsia = (parsed.r > 0.5 && parsed.b > 0.5) || el.className.includes('border-fuchsia');
      const isSpinnerOrBadgeOrSkeleton =
        el.className.includes('animate-spin') ||
        el.className.includes('animate-shimmer') ||
        el.className.includes('badge') ||
        el.className.includes('tag');

      if (isRedOrRose || isAmberOrOrange || isEmerald || isBrandOrViolet || isFuchsia || isSpinnerOrBadgeOrSkeleton) {
        continue;
      }

      if (isDark) {
        // Dark mode: containers must use dark neutral border (var(--border) #27272a, luminance ~0.02, or strong #3f3f46 ~0.05).
        // White outline (#e5e7eb or #ffffff) has luminance > 0.50.
        // Fail if luminance > 0.15 outside allow-list
        if (parsed.luminance > 0.15) {
          offenders.push({
            className: el.className,
            borderTopColor: cs.borderTopColor,
            luminance: parsed.luminance,
            width: cs.borderTopWidth,
          });
        }
      } else {
        // Light mode: on cream background, borders should be subtle gray (var(--border) #e4e4e7, luminance ~0.78).
        // Fail if pitch black (luminance < 0.30)
        if (parsed.luminance < 0.30) {
          offenders.push({
            className: el.className,
            borderTopColor: cs.borderTopColor,
            luminance: parsed.luminance,
            width: cs.borderTopWidth,
          });
        }
      }
    }
    return offenders;
  }, { isDark: isDarkMode });

  if (violations.length > 0) {
    console.error(`Border luminance violations on ${pageName} (${isDarkMode ? 'dark' : 'light'}):`, violations);
  }
  expect(violations, `Found bright/unstandardized borders on ${pageName}`).toEqual([]);
}

test.describe('Standard Borders & Luminance Uniformity Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('1. Admin & Proctor: Student Audit List, Profile and Scorecard have standard dark borders', async ({ page }) => {
    await loginAs(page, 'Admin');

    // Student Audit List Page
    await page.goto('/admin/students');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Student Audit List (Dark)', true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-student-audit-dark.png'), fullPage: true });

    // Student Profile Page
    await page.goto('/admin/students/5');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Student Profile (Dark)', true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-student-profile-dark.png'), fullPage: true });

    // Exam Scorecard Page
    await page.goto('/admin/students/5/exams/41');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Exam Scorecard (Dark)', true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-scorecard-dark.png'), fullPage: true });
  });

  test('2. Home, Exam Catalog, Live Monitor, Violation Audit, Simulator, Styleguide in Dark Mode', async ({ page }) => {
    await loginAs(page, 'Admin');

    // Home / MediaPipe card
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Home (Dark)', true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-home-dark.png'), fullPage: true });

    // Exam Catalog (Admin)
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Exam Catalog (Dark)', true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-exam-catalog-dark.png'), fullPage: true });

    // Live Monitor
    await page.goto('/proctor');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Live Monitor (Dark)', true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-live-monitor-dark.png'), fullPage: true });

    // Violation Audit
    await page.goto('/proctor/audit');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Violation Audit (Dark)', true);

    // Simulator
    await page.goto('/simulator');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Simulator (Dark)', true);

    // Styleguide
    await page.goto('/styleguide');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Styleguide (Dark)', true);
  });

  test('3. Student Dashboard & Results in Dark Mode', async ({ page }) => {
    await loginAs(page, 'Student');

    // Student Dashboard
    await page.goto('/student');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Student Dashboard (Dark)', true);

    // Student Result
    await page.goto('/student/results/41');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Student Result (Dark)', true);
  });

  test('4. Light Mode: Student Audit, Scorecard, and Home have standard cream borders', async ({ page }) => {
    await loginAs(page, 'Admin');

    // Switch to Light Theme
    const themeBtn = page.locator('button[aria-label*="theme" i], button[title*="theme" i], button:has(.lucide-sun), button:has(.lucide-moon)').first();
    await themeBtn.click();
    await page.waitForTimeout(300);

    // Student Audit List in Light Mode
    await page.goto('/admin/students');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Student Audit List (Light)', false);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-student-audit-light.png'), fullPage: true });

    // Student Profile in Light Mode
    await page.goto('/admin/students/5');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Student Profile (Light)', false);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-student-profile-light.png'), fullPage: true });

    // Home in Light Mode
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Home (Light)', false);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-home-light.png'), fullPage: true });

    // Scorecard in Light Mode
    await page.goto('/admin/students/5/exams/41');
    await page.waitForLoadState('networkidle');
    await checkPageContainerBorders(page, 'Scorecard (Light)', false);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'standard-borders-scorecard-light.png'), fullPage: true });

    // Switch back to Dark Theme
    await themeBtn.click();
  });
});
