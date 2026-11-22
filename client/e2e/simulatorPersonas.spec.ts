import { test, expect } from '@playwright/test';

test.describe('Simulator Personas, Realistic Cohort Outcomes & Summary Strip', () => {
  test.setTimeout(120000);

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

    await page.waitForTimeout(300);
  }

  test('UI displays scenario selector, seed input, persona chips, outcome pills, and summary strip upon completion', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // 1. Reset simulator state
    const authRaw = await page.evaluate(() => localStorage.getItem('proctoriq_auth_v1'));
    const token = authRaw ? JSON.parse(authRaw).token : '';
    if (token) {
      await page.request.post('http://localhost:4001/api/simulator/reset', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    await page.goto('/admin/simulator');
    await page.waitForLoadState('domcontentloaded');

    // 2. Verify controls: Target Exam, Scenario selector, Seed input
    const scenarioSelect = page.locator('select').nth(1);
    await expect(scenarioSelect).toBeVisible();
    await expect(scenarioSelect.locator('option')).toHaveCount(3);
    await scenarioSelect.selectOption('realistic');

    const seedInput = page.locator('input[placeholder*="Auto (or e.g. 42)"], input[placeholder*="e.g. 42"]');
    await expect(seedInput).toBeVisible();
    await seedInput.fill('cohort-e2e-seed-12');

    // Set speed to 5.0x for snappy test execution
    const speedSlider = page.locator('input[type="range"]').nth(1);
    await speedSlider.fill('5.0');

    // Set candidate count to 12
    const candidateSlider = page.locator('input[type="range"]').first();
    await candidateSlider.fill('12');
    await expect(page.getByText('12 Students')).toBeVisible();

    // 3. Launch Swarm
    const launchBtn = page.getByRole('button', { name: /Launch Swarm/i });
    await expect(launchBtn).toBeEnabled();
    await launchBtn.click();

    // Verify candidates are spawned
    await expect(page.getByText(/Simulated Candidates \(12\)/)).toBeVisible({
      timeout: 10000,
    });

    // 4. Verify persona chips are displayed on candidate cards
    await expect(page.locator('text=HONEST').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=MOSTLY HONEST').first()).toBeVisible({ timeout: 10000 });

    // 5. Wait for simulation to conclude and summary strip to appear
    const summaryStrip = page.getByTestId('simulator-summary-strip');
    await expect(summaryStrip).toBeVisible({ timeout: 60000 });

    // Verify summary strip contains clean, flagged, disqualified counts and averages
    await expect(summaryStrip.getByText(/Cohort Outcome Summary:/i)).toBeVisible();
    await expect(summaryStrip.getByText(/CLEAN/)).toBeVisible();
    await expect(summaryStrip.getByText(/FLAGGED/)).toBeVisible();
    await expect(summaryStrip.getByText(/Avg Score:/i)).toBeVisible();
    await expect(summaryStrip.getByText(/Avg Trust:/i)).toBeVisible();

    // 6. Verify activity stream states "Simulation complete."
    await expect(page.getByText(/Simulation complete\. All candidates have concluded their sessions\./i)).toBeVisible({
      timeout: 10000,
    });

    // 7. Verify candidate outcome pills show CLEAN, FLAGGED, or DISQUALIFIED
    const cleanPills = page.locator('span:has-text("CLEAN")');
    const flaggedPills = page.locator('span:has-text("FLAGGED")');
    expect(await cleanPills.count()).toBeGreaterThan(0);
    expect(await flaggedPills.count()).toBeGreaterThan(0);

    // Capture screenshot of completed simulation for visual confirmation
    await page.screenshot({
      path: 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9/e2e-simulator-personas-outcome.png',
      fullPage: true,
    });

    // Clean up with reset button
    const resetBtn = page.getByTestId('simulator-reset-btn');
    await expect(resetBtn).toBeEnabled();
    await resetBtn.click();

    const resetModal = page.getByRole('dialog');
    await expect(resetModal).toBeVisible();
    await resetModal.getByRole('button', { name: /^Reset$/i }).click();

    await expect(resetModal).not.toBeVisible();
    await expect(page.getByText(/No active candidate swarm running/i)).toBeVisible({ timeout: 10000 });
  });
});
