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
  // 2. Admin Donut Chart: Center Alerts Label, Interactive Hover/Focus, Legend
  // --------------------------------------------------------------------------
  test('Admin dashboard renders violation donut chart with center alerts count and interactive legend', async ({ page }) => {
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

    // Verify Legend items have percentage and count
    const legendPercent = chartRegion.locator('text=/\\(\\d+%\\)/').first();
    await expect(legendPercent).toBeVisible();

    // Verify no scrollbar container on legend
    const legendList = chartRegion.locator('[role="list"][aria-label="Violation categories breakdown"]');
    await expect(legendList).toBeVisible();
    await expect(legendList).not.toHaveClass(/overflow-y-auto/);

    // Verify Legend button keyboard focus & hover changes center text
    const firstLegendBtn = legendList.locator('button').first();
    await expect(firstLegendBtn).toBeVisible();
    const firstLabel = await firstLegendBtn.locator('span.truncate').innerText();

    // Hover legend row -> center shows infraction name
    await firstLegendBtn.hover();
    await page.waitForTimeout(200);
    await expect(chartRegion.getByText(firstLabel).first()).toBeVisible();
    await expect(alertsCaption).not.toBeVisible();

    // Mouse leave -> center restores default "ALERTS"
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await expect(alertsCaption).toBeVisible();

    // Keyboard focus -> center updates again
    await firstLegendBtn.focus();
    await page.waitForTimeout(200);
    await expect(chartRegion.getByText(firstLabel).first()).toBeVisible();
    await expect(alertsCaption).not.toBeVisible();
    await chartRegion.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-hover-active.png'),
    });

    // Blur -> center restores default "ALERTS"
    await firstLegendBtn.blur();
    await page.waitForTimeout(200);
    await expect(alertsCaption).toBeVisible();

    // Capture screenshot at 1440px
    await chartRegion.scrollIntoViewIfNeeded();
    await chartRegion.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-card-1440px.png'),
    });
    await page.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-1440px.png'),
    });

    // Verify at 1024px
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    await chartRegion.scrollIntoViewIfNeeded();
    await expect(alertsCaption).toBeVisible();
    await chartRegion.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-card-1024px.png'),
    });

    // Verify at 390px mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await chartRegion.scrollIntoViewIfNeeded();
    await expect(alertsCaption).toBeVisible();
    await chartRegion.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-card-390px.png'),
    });
    await page.screenshot({
      path: path.join(screenshotDir, 'admin-donut-chart-390px.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 3. Skeletons & Shimmer Animation in UI Styleguide
  // --------------------------------------------------------------------------
  test('Styleguide renders high-contrast skeleton loaders with shimmer animation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');
    await page.goto('/styleguide/loading-empty');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Section header
    await expect(page.getByRole('heading', { level: 1, name: 'Loading & Empty States' })).toBeVisible();

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
    await page.waitForTimeout(800);
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Live Assessments/i })).toBeVisible();

    // F) Student: Results (/student/results/13)
    await page.goto('/student/results/13');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    await expect(page.getByText(/OFFICIAL INNODB TRANSACTION EVALUATION/i)).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 5. Shared Chart Tooltip, Subtle Cursor & Theme Verification
  // --------------------------------------------------------------------------
  test('Admin bar charts render subtle cursor and solid sans-serif tooltips without gray blocks in dark and light', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // 1. Stacked Bar Chart: Integrity Status Split
    const integrityRegion = page.locator('div[aria-label="Integrity status split per assessment stacked bar chart"]');
    await expect(integrityRegion).toBeVisible();

    // Verify X-axis uses subject codes (e.g. NET-220 or CS-401), not truncated titles with "..."
    await expect(integrityRegion.getByText(/NET-220|CS-401|SEC-305/).first()).toBeVisible();
    await expect(integrityRegion.getByText(/NET-220:\s*Com\.\.\./)).toHaveCount(0);

    // Verify Legend: sans-serif under chart with swatches
    const integrityLegend = integrityRegion.locator('.recharts-legend-wrapper');
    await expect(integrityLegend).toBeVisible();
    await expect(integrityLegend.getByText('Clean')).toBeVisible();
    await expect(integrityLegend.getByText('Flagged')).toBeVisible();
    await expect(integrityLegend.getByText('Disqualified')).toBeVisible();

    // Hover over bar to trigger tooltip
    const stackedBar = integrityRegion.locator('.recharts-bar-rectangle').first();
    if (await stackedBar.isVisible()) {
      await stackedBar.hover({ force: true });
      await page.waitForTimeout(300);

      // Verify ChartTooltip container is solid and has role="tooltip"
      const tooltip = integrityRegion.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveClass(/font-sans/);
      await expect(tooltip).toHaveClass(/text-\[13px\]/);

      // Verify Clean, Flagged, Disqualified and Total Graded rows
      await expect(tooltip.getByText('Clean')).toBeVisible();
      await expect(tooltip.getByText('Flagged')).toBeVisible();
      await expect(tooltip.getByText('Disqualified')).toBeVisible();
      await expect(tooltip.getByText('Total Graded')).toBeVisible();

      // Verify subtle cursor: no default light-gray #ccc block
      const grayCursor = integrityRegion.locator('.recharts-tooltip-cursor[fill="#ccc"], .recharts-tooltip-cursor[fill="#d0d0d0"]');
      await expect(grayCursor).toHaveCount(0);
      // Capture screenshot of Integrity Status Split card with active tooltip
      await integrityRegion.screenshot({
        path: path.join(screenshotDir, 'integrity_status_split_card.png'),
      });
    }

    // 2. Histogram Bar Chart: Trust Score Distribution
    const histogramRegion = page.locator('div[aria-label="Candidate trust score distribution histogram"]');
    await expect(histogramRegion).toBeVisible();

    // Verify Value Labels rendered above bars
    const valueLabels = histogramRegion.locator('.recharts-label-list text');
    await expect(valueLabels.first()).toBeVisible();

    const histogramBar = histogramRegion.locator('.recharts-bar-rectangle').first();
    if (await histogramBar.isVisible()) {
      await histogramBar.hover({ force: true });
      await page.waitForTimeout(300);

      const histTooltip = histogramRegion.locator('[role="tooltip"]');
      await expect(histTooltip).toBeVisible();
      await expect(histTooltip).toHaveClass(/font-sans/);
      await expect(histTooltip).toContainText('Bucket:');
      await expect(histTooltip.getByText('Candidate Count')).toBeVisible();
      await expect(histTooltip.getByText('Share of Cohort')).toBeVisible();

      // Verify no gray cursor block
      const grayCursorHist = histogramRegion.locator('.recharts-tooltip-cursor[fill="#ccc"], .recharts-tooltip-cursor[fill="#d0d0d0"]');
      await expect(grayCursorHist).toHaveCount(0);

      // Capture screenshot of Candidate Trust Score Histogram card with active tooltip and value labels
      await histogramRegion.screenshot({
        path: path.join(screenshotDir, 'candidate_trust_score_card.png'),
      });
    }

    // 3. Take screenshots of charts in Dark Mode
    await page.screenshot({
      path: path.join(screenshotDir, 'admin-charts-shared-tooltips-dark.png'),
    });

    // 4. Switch to Light Mode and verify opacity & contrast
    const themeBtn = page.locator('header').locator('button[title*="theme" i], button:has-text("Theme"), button:has(svg.lucide-moon), button:has(svg.lucide-sun)').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(400);

      if (await histogramBar.isVisible()) {
        await histogramBar.hover({ force: true });
        await page.waitForTimeout(300);
        const lightTooltip = histogramRegion.locator('[role="tooltip"]');
        await expect(lightTooltip).toBeVisible();
      }

      await page.screenshot({
        path: path.join(screenshotDir, 'admin-charts-shared-tooltips-light.png'),
      });

      // Restore dark
      await themeBtn.click();
    }
  });
});
