import { test, expect } from '@playwright/test';

test.describe('Circadian Incident Heatmap (14.3.6 Matrix & Insights Verification)', () => {
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
        { timeout: 10000 }
      ),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);

    await page.waitForTimeout(300);
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
  }

  test('Heatmap renders 24-hour matrix, insights summary, and row/column totals matching seeded data', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Locate the heatmap container
    const heatmap = page.getByRole('region', { name: /circadian incident heatmap/i });
    await expect(heatmap).toBeVisible({ timeout: 10000 });

    // Verify Time Range toggle exists
    const allTimeBtn = heatmap.getByTestId('heatmap-range-all');
    const days7Btn = heatmap.getByTestId('heatmap-range-7');
    await expect(allTimeBtn).toBeVisible();
    await expect(days7Btn).toBeVisible();

    // Verify Insights Bar
    const insightsBar = heatmap.getByTestId('heatmap-insights');
    await expect(insightsBar).toBeVisible();

    const grandTotalEl = heatmap.getByTestId('insight-grand-total');
    await expect(grandTotalEl).toBeVisible();
    const grandTotalText = await grandTotalEl.textContent();
    expect(grandTotalText).toMatch(/\d+\s+incidents/);
    expect(parseInt(grandTotalText || '0', 10)).toBeGreaterThan(200);
    expect(grandTotalText).toContain('incidents');

    const peakHourEl = heatmap.getByTestId('insight-peak-hour');
    await expect(peakHourEl).toBeVisible();
    const peakHourText = await peakHourEl.textContent();
    expect(peakHourText).toMatch(/\d{2}:00 \(\d{1,2} [AP]M\)/);

    const topViolationEl = heatmap.getByTestId('insight-top-violation');
    await expect(topViolationEl).toBeVisible();
    const topViolationText = await topViolationEl.textContent();
    expect(topViolationText).toContain('Copy / Paste Attempt');

    // Verify Desktop Grid structure: headers (VIOLATION TYPE, 3h compact labels 12a..9p, TOTAL)
    const desktopGrid = heatmap.getByTestId('heatmap-desktop-grid');
    await expect(desktopGrid).toBeVisible();
    await expect(desktopGrid.getByText('VIOLATION TYPE')).toBeVisible();
    await expect(desktopGrid.getByText('12a', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('9p', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('TOTAL', { exact: true })).toBeVisible();

    // Verify row totals for seeded violation types
    const copyPasteRowTotal = heatmap.getByTestId('row-total-COPY_PASTE');
    await expect(copyPasteRowTotal).toBeVisible();
    const copyPasteTotal = await copyPasteRowTotal.textContent();
    expect(Number(copyPasteTotal?.trim())).toBeGreaterThanOrEqual(89);

    const fullscreenRowTotal = heatmap.getByTestId('row-total-FULLSCREEN_EXIT');
    await expect(fullscreenRowTotal).toBeVisible();
    const fullscreenTotal = await fullscreenRowTotal.textContent();
    expect(Number(fullscreenTotal?.trim())).toBeGreaterThanOrEqual(71);

    const tabSwitchRowTotal = heatmap.getByTestId('row-total-TAB_SWITCH');
    await expect(tabSwitchRowTotal).toBeVisible();
    const tabSwitchTotal = await tabSwitchRowTotal.textContent();
    expect(Number(tabSwitchTotal?.trim())).toBeGreaterThanOrEqual(67);

    // Verify bottom summary row has grand total
    const bottomSummary = heatmap.getByTestId('heatmap-bottom-summary');
    await expect(bottomSummary).toBeVisible();
    const grandTotalCell = heatmap.getByTestId('grand-total-cell');
    await expect(grandTotalCell).toBeVisible();
    const grandTotalVal = await grandTotalCell.textContent();
    expect(Number(grandTotalVal?.trim())).toBeGreaterThanOrEqual(300);
  });

  test('Heatmap toggles between All time and Last 7 days with reactive data updates', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const heatmap = page.getByRole('region', { name: /circadian incident heatmap/i });
    await expect(heatmap).toBeVisible({ timeout: 10000 });

    const allTimeBtn = heatmap.getByTestId('heatmap-range-all');
    const days7Btn = heatmap.getByTestId('heatmap-range-7');

    // Initial state: All time
    const initialGrandTotal = await heatmap.getByTestId('grand-total-cell').textContent();
    expect(Number(initialGrandTotal?.trim())).toBeGreaterThanOrEqual(300);

    // Switch to Last 7 days
    await days7Btn.click();

    // Wait for the query to update and grand total to reflect 7-day window
    await expect(async () => {
      const updatedTotalText = await heatmap.getByTestId('grand-total-cell').textContent();
      const updatedTotal = Number(updatedTotalText?.trim());
      expect(updatedTotal).toBeGreaterThanOrEqual(74);
      expect(updatedTotal).toBeLessThan(Number(initialGrandTotal?.trim()));
    }).toPass({ timeout: 10000 });

    // Switch back to All time
    await allTimeBtn.click();
    await expect(async () => {
      const restoredTotalText = await heatmap.getByTestId('grand-total-cell').textContent();
      expect(Number(restoredTotalText?.trim())).toBeGreaterThanOrEqual(300);
    }).toPass({ timeout: 10000 });
  });

  test('Heatmap switches to 6 four-hour buckets on mobile screens (< 640px)', async ({
    page,
  }) => {
    // Set viewport to mobile width (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);

    const heatmap = page.getByRole('region', { name: /circadian incident heatmap/i });
    await expect(heatmap).toBeVisible({ timeout: 10000 });

    // Desktop 24-hour grid should be hidden on < 640px
    const desktopGrid = heatmap.getByTestId('heatmap-desktop-grid');
    await expect(desktopGrid).toBeHidden();

    // Mobile 6-bucket grid should be visible
    const mobileGrid = heatmap.getByTestId('heatmap-mobile-grid');
    await expect(mobileGrid).toBeVisible();

    // Verify 6 bucket labels are present
    await expect(mobileGrid.getByText('00-03h')).toBeVisible();
    await expect(mobileGrid.getByText('04-07h')).toBeVisible();
    await expect(mobileGrid.getByText('08-11h')).toBeVisible();
    await expect(mobileGrid.getByText('12-15h')).toBeVisible();
    await expect(mobileGrid.getByText('16-19h')).toBeVisible();
    await expect(mobileGrid.getByText('20-23h')).toBeVisible();
  });

  test('Heatmap professional design: 5-step indigo palette, compact 3h labels, column strip, legend, and solid hover tooltip with crosshair and arrow keys', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    const heatmap = page.getByRole('region', { name: /circadian incident heatmap/i });
    await expect(heatmap).toBeVisible({ timeout: 10000 });

    // 1. Header subtitle: insights line from helper
    await expect(heatmap.getByText(/peak hour:/i)).toBeVisible();
    await expect(heatmap.getByText(/most frequent:/i)).toBeVisible();
    await expect(heatmap.getByText(/quietest:/i)).toBeVisible();

    // 2. Compact hour labels every 3 hours (12a, 3a, 6a, 9a, 12p, 3p, 6p, 9p)
    const desktopGrid = heatmap.getByTestId('heatmap-desktop-grid');
    await expect(desktopGrid.getByText('12a', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('3a', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('6a', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('9a', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('12p', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('3p', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('6p', { exact: true })).toBeVisible();
    await expect(desktopGrid.getByText('9p', { exact: true })).toBeVisible();

    // 3. Legend: "Less" to "More" with 5 swatches under the grid
    const legend = heatmap.getByRole('group', { name: /infraction intensity legend/i });
    await expect(legend).toBeVisible();
    await expect(heatmap.getByText('Less', { exact: true })).toBeVisible();
    await expect(heatmap.getByText('More', { exact: true })).toBeVisible();

    // 4. Cell styling & aria-labels
    const cell16Copy = heatmap.getByTestId('cell-COPY_PASTE-16');
    await expect(cell16Copy).toBeVisible();
    const cellAria = await cell16Copy.getAttribute('aria-label');
    expect(cellAria).toMatch(/copy \/ paste attempt, \d+ [ap]m to \d+ [ap]m, \d+ incidents/i);

    // 5. Hover interaction: displays shared solid tooltip with hour range, count, share of total
    await cell16Copy.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText(/time window/i)).toBeVisible();
    await expect(tooltip.getByText('Incidents', { exact: true })).toBeVisible();
    await expect(tooltip.getByText(/share of grand total/i)).toBeVisible();
    await expect(tooltip.getByText(/share of .* [ap]m total/i)).toBeVisible();

    // 6. Keyboard accessibility: arrow-key navigation
    await cell16Copy.focus();
    await page.keyboard.press('ArrowRight'); // moves to hour 17
    const cell17Copy = heatmap.getByTestId('cell-COPY_PASTE-17');
    await expect(cell17Copy).toBeFocused();

    // 7. Verify in Light Mode
    const themeBtn = page.getByRole('button', { name: /current theme/i });
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      await expect(heatmap).toBeVisible();
      await expect(desktopGrid).toBeVisible();
    }
  });
});
