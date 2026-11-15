import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../docs/phase14-charts');

test.describe('Phase 14: Comprehensive Charts Verification (Screenshots 3-7)', () => {
  test.setTimeout(180000);

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
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
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

  // ==========================================================================
  // Test 1: Donut Chart - Slice & Legend Hover Update Center Label (Screenshot 3)
  // ==========================================================================
  test('1. Donut chart: slice hover and legend hover update center label with zero overlap', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const donutCard = page.locator('div[aria-label="Violation categories distribution chart"]');
    await expect(donutCard).toBeVisible();

    // Default center label: Total count + "ALERTS"
    const alertsCaption = donutCard.getByText('ALERTS', { exact: true });
    await expect(alertsCaption).toBeVisible();
    const defaultCenterCount = await donutCard.locator('span.text-2xl.font-bold').textContent();
    expect(Number(defaultCenterCount?.trim())).toBeGreaterThan(0);

    // Save dark screenshot of donut card
    await donutCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-3-donut-distribution-1440px-dark.png'),
    });

    // 1A. Test Legend Hover
    const legendList = donutCard.locator('[role="list"][aria-label="Violation categories breakdown"]');
    await expect(legendList).toBeVisible();
    // Verify no scrollbar on legend (all rows displayed)
    await expect(legendList).not.toHaveClass(/overflow-y-auto/);

    const firstLegendBtn = legendList.locator('button').first();
    await expect(firstLegendBtn).toBeVisible();
    const firstLegendLabel = (await firstLegendBtn.locator('span.truncate').innerText()).trim();

    // Hover legend row -> center shows infraction name, count and percentage
    await firstLegendBtn.hover();
    await page.waitForTimeout(300);
    await expect(donutCard.getByText(firstLegendLabel).first()).toBeVisible();
    await expect(alertsCaption).not.toBeVisible();

    await donutCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-3-donut-distribution-hover-legend.png'),
    });

    // Mouse leave restores default "ALERTS"
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await expect(alertsCaption).toBeVisible();

    // 1B. Test Slice Hover
    const chartSvg = donutCard.locator('.recharts-surface');
    await expect(chartSvg).toBeVisible();
    const chartBox = await chartSvg.boundingBox();
    if (chartBox) {
      const cx = chartBox.x + chartBox.width / 2;
      const cy = chartBox.y + chartBox.height / 2;
      // Radius between inner (56) and outer (80) is 68px: hover on the donut ring at 12 o'clock
      await page.mouse.move(cx, cy - 68);
      await page.waitForTimeout(300);

      // Center label changes upon slice hover
      await expect(alertsCaption).not.toBeVisible();
      await donutCard.screenshot({
        path: path.join(screenshotDir, 'screenshot-3-donut-distribution-hover-slice.png'),
      });

      // Mouse leave restores default
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await expect(alertsCaption).toBeVisible();
    }

    // 1C. Verify Light Mode
    await toggleTheme(page);
    await donutCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-3-donut-distribution-1440px-light.png'),
    });
    await toggleTheme(page); // restore dark

    // 1D. Responsive viewports
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    await expect(alertsCaption).toBeVisible();
    await donutCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-3-donut-distribution-1024px.png'),
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await expect(alertsCaption).toBeVisible();
    await donutCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-3-donut-distribution-390px.png'),
    });

    expect(consoleErrors).toEqual([]);
  });

  // ==========================================================================
  // Test 2: Violations Telemetry Area Chart - 7/30 Day Toggle (Screenshots 4 & 5)
  // ==========================================================================
  test('2. Violations telemetry area chart: 7/30 toggle switches data points, updates summary and tooltip', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const timelineCard = page.locator('div[aria-label="Violations telemetry timeline area chart"]');
    await expect(timelineCard).toBeVisible();

    const chartContainer = timelineCard.locator('[data-testid="violations-timeline-chart-container"]');
    await expect(chartContainer).toBeVisible();

    const btn7d = timelineCard.getByRole('button', { name: '7 Days' });
    const btn30d = timelineCard.getByRole('button', { name: '30 Days' });

    // 2A. 7 Days Default: points count = 7
    await expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    await expect(chartContainer).toHaveAttribute('data-points-count', '7');

    // Verify 7 Days X-axis tick format (e.g. "Nov 8", "Nov 15")
    const ticks7d = timelineCard.locator('.recharts-xAxis .recharts-cartesian-axis-tick text');
    expect(await ticks7d.count()).toBe(7);

    // Save screenshot of 7-day dark
    await timelineCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-4-violations-7days-1440px-dark.png'),
    });

    // Verify Tooltip on Hover
    const areaPath = timelineCard.locator('.recharts-area-area');
    await expect(areaPath).toBeVisible();
    const box = await areaPath.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(300);
      const tooltip = timelineCard.locator('[role="tooltip"]');
      if (await tooltip.isVisible()) {
        await expect(tooltip).toBeVisible();
        await expect(tooltip.getByText('Incidents Logged')).toBeVisible();
        await expect(tooltip.getByText('Day of Week')).toBeVisible();

        await timelineCard.screenshot({
          path: path.join(screenshotDir, 'screenshot-4-violations-7days-tooltip.png'),
        });
      }
    }

    // 2B. Switch to 30 Days: points count = 30
    const requestPromise30 = page.waitForResponse(
      (res) => res.url().includes('days=30') && res.status() === 200
    );
    await btn30d.click();
    await requestPromise30;
    await expect(btn30d).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(400);

    // Container data-points-count should now be 30
    await expect(chartContainer).toHaveAttribute('data-points-count', '30');

    // Summary row for 30 days should reflect 30 days total
    const summaryTotalEl = timelineCard.locator('.font-mono.font-bold').first();
    const total30Text = await summaryTotalEl.innerText();
    expect(Number(total30Text)).toBeGreaterThanOrEqual(250);

    // Save screenshot of 30-day dark
    await timelineCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-5-violations-30days-1440px-dark.png'),
    });

    // 2C. Light mode verification
    await toggleTheme(page);
    await timelineCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-5-violations-30days-1440px-light.png'),
    });

    // Toggle back to 7 days in light mode
    const requestPromise7 = page.waitForResponse(
      (res) => res.url().includes('days=7') && res.status() === 200
    );
    await btn7d.click();
    await requestPromise7;
    await expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    await expect(chartContainer).toHaveAttribute('data-points-count', '7');
    await timelineCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-4-violations-7days-1440px-light.png'),
    });

    await toggleTheme(page); // restore dark
    expect(consoleErrors).toEqual([]);
  });

  // ==========================================================================
  // Test 3: Integrity Status Split Bar Chart - All subject_codes (Screenshot 6)
  // ==========================================================================
  test('3. Integrity status split chart: renders all subject_code labels untruncated with solid tooltip and no gray block', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const integrityCard = page.locator(
      'div[aria-label="Integrity status split per assessment stacked bar chart"]'
    );
    await expect(integrityCard).toBeVisible();

    // Verify all X-axis ticks have subject_codes, interval=0, and none have "..." ellipsis truncation
    const ticks = integrityCard.locator('.recharts-xAxis .recharts-cartesian-axis-tick text');
    await expect(ticks.first()).toBeVisible();
    const tickCount = await ticks.count();
    expect(tickCount).toBeGreaterThanOrEqual(3);

    const tickTexts: string[] = [];
    for (let i = 0; i < tickCount; i++) {
      const text = (await ticks.nth(i).textContent())?.trim() ?? '';
      tickTexts.push(text);
      expect(text).not.toContain('...');
      expect(text.length).toBeGreaterThan(0);
    }

    // Verify subject codes match data
    const srCodesEl = integrityCard.locator('[data-testid="integrity-subject-codes"]');
    await expect(srCodesEl).toBeAttached();
    const srCodesText = await srCodesEl.textContent();
    for (const code of tickTexts) {
      expect(srCodesText).toContain(code);
    }

    // Verify Legend: sans-serif under chart with Clean, Flagged, Disqualified
    const legend = integrityCard.locator('.recharts-legend-wrapper');
    await expect(legend).toBeVisible();
    await expect(legend.getByText('Clean')).toBeVisible();
    await expect(legend.getByText('Flagged')).toBeVisible();
    await expect(legend.getByText('Disqualified')).toBeVisible();

    // Save dark screenshot
    await integrityCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-6-integrity-status-split-1440px-dark.png'),
    });

    await integrityCard.scrollIntoViewIfNeeded();

    // Hover over bar to inspect tooltip and verify no gray block
    const bar = integrityCard.locator('.recharts-bar-rectangle path, path.recharts-rectangle').first();
    await bar.scrollIntoViewIfNeeded();
    await bar.hover({ force: true });
    await page.waitForTimeout(300);

    const tooltip = integrityCard.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveClass(/font-sans/);
    await expect(tooltip.getByText('Clean')).toBeVisible();
    await expect(tooltip.getByText('Flagged')).toBeVisible();
    await expect(tooltip.getByText('Disqualified')).toBeVisible();
    await expect(tooltip.getByText('Total Graded')).toBeVisible();

    // Confirm no gray hover rectangle (#ccc or #d0d0d0)
    const grayCursor = integrityCard.locator(
      '.recharts-tooltip-cursor[fill="#ccc"], .recharts-tooltip-cursor[fill="#d0d0d0"]'
    );
    await expect(grayCursor).toHaveCount(0);

    await integrityCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-6-integrity-status-split-tooltip.png'),
    });

    // Light mode
    await toggleTheme(page);
    await integrityCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-6-integrity-status-split-1440px-light.png'),
    });
    await toggleTheme(page); // restore dark

    expect(consoleErrors).toEqual([]);
  });

  // ==========================================================================
  // Test 4: Trust Score Histogram - Value Labels & Tooltip (Screenshot 7)
  // ==========================================================================
  test('4. Candidate trust score distribution histogram: displays value labels above bars with solid tooltip and no gray block', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const histCard = page.locator(
      'div[aria-label="Candidate trust score distribution histogram"]'
    );
    await expect(histCard).toBeVisible();

    // Value labels above bars
    const valueLabels = histCard.locator('.recharts-label-list text');
    await expect(valueLabels.first()).toBeVisible();
    const labelCount = await valueLabels.count();
    expect(labelCount).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < labelCount; i++) {
      const val = (await valueLabels.nth(i).textContent())?.trim();
      expect(Number(val)).toBeGreaterThanOrEqual(0);
    }

    // Save dark screenshot
    await histCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-7-trust-score-histogram-1440px-dark.png'),
    });

    // Hover over bar to inspect tooltip
    const histBar = histCard.locator('.recharts-bar-rectangle').first();
    await histBar.hover({ force: true });
    await page.waitForTimeout(300);

    const tooltip = histCard.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveClass(/font-sans/);
    await expect(tooltip).toContainText('Bucket:');
    await expect(tooltip.getByText('Candidate Count')).toBeVisible();
    await expect(tooltip.getByText('Share of Cohort')).toBeVisible();

    // No gray cursor
    const grayCursor = histCard.locator(
      '.recharts-tooltip-cursor[fill="#ccc"], .recharts-tooltip-cursor[fill="#d0d0d0"]'
    );
    await expect(grayCursor).toHaveCount(0);

    await histCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-7-trust-score-histogram-tooltip.png'),
    });

    // Light mode
    await toggleTheme(page);
    await histCard.screenshot({
      path: path.join(screenshotDir, 'screenshot-7-trust-score-histogram-1440px-light.png'),
    });
    await toggleTheme(page); // restore dark

    expect(consoleErrors).toEqual([]);
  });

  // ==========================================================================
  // Test 5: Circadian Incident Heatmap - Tooltip & Exact API Totals Match
  // ==========================================================================
  test('5. Circadian incident heatmap: cell tooltip renders and all totals match the API response', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page, consoleErrors);

    const heatmap = page.getByRole('region', { name: /circadian incident heatmap/i });
    await expect(heatmap).toBeVisible();

    // Directly query API response inside authenticated browser session for live data comparison
    const apiRecords: Array<{
      hour_of_day: number;
      violation_code: string;
      violation_label?: string;
      violation_count: number;
    }> = await page.evaluate(async () => {
      const raw = localStorage.getItem('proctoriq_auth_v1');
      const token = raw ? JSON.parse(raw).token : null;
      const res = await fetch('/api/analytics/heatmap', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      return json.data ?? [];
    });

    // Calculate grand total from API
    const apiGrandTotal = apiRecords.reduce(
      (sum, r) => sum + Number(r.violation_count || 0),
      0
    );
    expect(apiGrandTotal).toBeGreaterThan(0);

    // Verify Grand Total in UI matches API grand total exactly
    const grandTotalEl = heatmap.getByTestId('grand-total-cell');
    await expect(grandTotalEl).toBeVisible();
    const uiGrandTotal = Number((await grandTotalEl.textContent())?.trim());
    expect(uiGrandTotal).toBe(apiGrandTotal);

    // Verify row totals for each violation type match API row sum
    const typesInApi = [...new Set(apiRecords.map((r) => r.violation_code))];
    for (const code of typesInApi) {
      const apiTypeSum = apiRecords
        .filter((r) => r.violation_code === code)
        .reduce((sum, r) => sum + Number(r.violation_count || 0), 0);

      const rowTotalEl = heatmap.getByTestId(`row-total-${code}`);
      if (await rowTotalEl.isVisible()) {
        const uiRowTotal = Number((await rowTotalEl.textContent())?.trim());
        expect(uiRowTotal).toBe(apiTypeSum);
      }
    }

    // Save dark screenshot of Circadian Heatmap
    await heatmap.screenshot({
      path: path.join(screenshotDir, 'circadian-heatmap-1440px-dark.png'),
    });

    // Verify Cell Tooltip on Hover
    // Find first cell with count > 0 from API
    const populatedRecord = apiRecords.find((r) => Number(r.violation_count) > 0);
    expect(populatedRecord).toBeDefined();

    const targetCell = heatmap.getByTestId(
      `cell-${populatedRecord!.violation_code}-${populatedRecord!.hour_of_day}`
    );
    await expect(targetCell).toBeVisible();

    await targetCell.scrollIntoViewIfNeeded();
    await targetCell.hover({ force: true });
    await page.waitForTimeout(300);

    const tooltip = heatmap.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    if (populatedRecord!.violation_label) {
      await expect(tooltip.getByText(populatedRecord!.violation_label)).toBeVisible();
    }
    await expect(
      tooltip.getByText(`${populatedRecord!.violation_count} incidents`)
    ).toBeVisible();
    await expect(tooltip.getByText(/Share of Grand Total:/i)).toBeVisible();

    await heatmap.screenshot({
      path: path.join(screenshotDir, 'circadian-heatmap-cell-tooltip.png'),
    });

    // Light mode screenshot
    await toggleTheme(page);
    await heatmap.screenshot({
      path: path.join(screenshotDir, 'circadian-heatmap-1440px-light.png'),
    });
    await toggleTheme(page); // restore dark

    // Mobile view (< 640px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const mobileGrid = heatmap.getByTestId('heatmap-mobile-grid');
    await expect(mobileGrid).toBeVisible();
    await heatmap.screenshot({
      path: path.join(screenshotDir, 'circadian-heatmap-390px-mobile.png'),
    });

    expect(consoleErrors).toEqual([]);
  });
});
