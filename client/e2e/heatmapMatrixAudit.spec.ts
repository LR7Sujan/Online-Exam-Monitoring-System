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
    expect(grandTotalText).toContain('30'); // 300+ incidents
    expect(grandTotalText).toContain('incidents');

    const peakHourEl = heatmap.getByTestId('insight-peak-hour');
    await expect(peakHourEl).toBeVisible();
    const peakHourText = await peakHourEl.textContent();
    expect(peakHourText).toContain('16:00 (4 PM)');

    const topViolationEl = heatmap.getByTestId('insight-top-violation');
    await expect(topViolationEl).toBeVisible();
    const topViolationText = await topViolationEl.textContent();
    expect(topViolationText).toContain('Copy / Paste Attempt');

    // Verify Desktop Grid structure: headers (VIOLATION TYPE, 00h..23h, TOTAL)
    const desktopGrid = heatmap.getByTestId('heatmap-desktop-grid');
    await expect(desktopGrid).toBeVisible();
    await expect(desktopGrid.getByText('VIOLATION TYPE')).toBeVisible();
    await expect(desktopGrid.getByText('00h')).toBeVisible();
    await expect(desktopGrid.getByText('23h')).toBeVisible();
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
});
