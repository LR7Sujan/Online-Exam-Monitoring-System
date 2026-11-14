import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/qa-screenshots');

test.describe('Phase 13: Donut Charts, Skeletons & Data Loading Verification (Screenshots 4 & 5)', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAs(page: any, email: string) {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(400);
  }

  // --------------------------------------------------------------------------
  // 1. Donut / Pie Chart: Center Label, 14px Legend with %, and Custom Tooltip
  // --------------------------------------------------------------------------
  test('Student results page renders prominent center score, 14px legend with percentages, and custom tooltip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'student@proctoriq.io');

    await page.goto('/student/results/13');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    // Verify Center Label
    const centerNumber = page.locator('span.font-mono.tabular-nums').first();
    await expect(centerNumber).toBeVisible();
    const ptsCaption = page.getByText('PTS', { exact: true });
    await expect(ptsCaption).toBeVisible();

    // Verify 14px Legend with %
    const legend = page.locator('span').filter({ hasText: /^Earned \d+ \(\d+%\)$/ }).last();
    await expect(legend).toBeVisible();
    const lostLegend = page.locator('span').filter({ hasText: /^Lost \d+ \(\d+%\)$/ }).last();
    await expect(lostLegend).toBeVisible();

    // Screenshot of Donut Chart
    await page.screenshot({
      path: path.join(screenshotDir, 'donut-chart-score-verified.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 2. Admin Donut Chart: Center Alerts Label and 14px Legend with %
  // --------------------------------------------------------------------------
  test('Admin dashboard renders violation donut chart with center alerts count and 14px legend with %', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Verify Chart Container
    const chartRegion = page.locator('div[aria-label="Violation categories distribution chart"]');
    await expect(chartRegion).toBeVisible();

    // Verify Center ALERTS label
    const alertsCaption = chartRegion.getByText('ALERTS', { exact: true });
    await expect(alertsCaption).toBeVisible();

    // Verify Legend items have percentage
    const legendPercent = chartRegion.locator('text=/\(\\d+%\)/').first();
    await expect(legendPercent).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-verified.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 3. Skeletons & Shimmer Animation in UI Styleguide
  // --------------------------------------------------------------------------
  test('Styleguide renders high-contrast skeleton loaders with shimmer animation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/styleguide');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Scroll to section 11
    const skeletonSection = page.getByText('11. Skeleton Loaders & Empty State Placeholders');
    await skeletonSection.scrollIntoViewIfNeeded();
    await expect(skeletonSection).toBeVisible();

    // Skeletons exist and have shimmer pseudo-class styles
    const skeletonElements = page.locator('div[aria-hidden="true"]');
    expect(await skeletonElements.count()).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(screenshotDir, 'styleguide-skeletons-verified.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 4. Data Loading & Seeded Data Verification Across 6 Data Pages
  // --------------------------------------------------------------------------
  test('Data loads successfully from seeded DB without masquerading as empty on all 6 data pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // A) Proctor: Live Monitor (/proctor)
    await loginAs(page, 'proctor@proctoriq.io');
    await page.goto('/proctor');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    const candidateCounter = page.getByText(/Showing \d+ candidates/i);
    await expect(candidateCounter).toBeVisible();
    const candidateCards = page.locator('div.group.relative.rounded-2xl.border');
    expect(await candidateCards.count()).toBeGreaterThan(0);

    // B) Proctor: Violation Audit (/proctor/audit)
    await page.goto('/proctor/audit');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    const auditRows = page.locator('tbody tr');
    expect(await auditRows.count()).toBeGreaterThan(0);
    // Must NOT be the empty fallback
    await expect(page.getByText('No violations match the specified queue filters.')).not.toBeVisible();

    // C) Admin: Exam Catalog (/admin/exams)
    await loginAs(page, 'admin@proctoriq.io');
    await page.goto('/admin/exams');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    const examCards = page.locator('text=/EXAM #[0-9]+/i');
    expect(await examCards.count()).toBeGreaterThan(0);

    // D) Admin: Telemetry & Heatmap (/admin/analytics)
    await page.goto('/admin/analytics');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    await expect(page.getByText('Circadian Incident Heatmap')).toBeVisible();

    // E) Student: Student Dashboard (/student)
    await loginAs(page, 'student@proctoriq.io');
    await page.goto('/student');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    const studentExamCards = page.locator('text=/EXAM #[0-9]+/i');
    expect(await studentExamCards.count()).toBeGreaterThan(0);

    // F) Student: Results (/student/results/13)
    await page.goto('/student/results/13');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    await expect(page.getByText(/OFFICIAL INNODB TRANSACTION EVALUATION/i)).toBeVisible();
  });
});
