import { test, expect } from '@playwright/test';

test.describe('Candidate Swarm Demo Simulator: Reset Button & Cleanup Lifecycle', () => {
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

  test('Full Reset Lifecycle: Launch -> Non-zero stats -> Confirm Modal -> Reset to Zero -> Re-launch', async ({
    page,
    context,
  }) => {
    await loginAsAdmin(page);

    // Ensure clean simulator slate before starting test lifecycle
    const authRaw = await page.evaluate(() => localStorage.getItem('proctoriq_auth_v1'));
    const token = authRaw ? JSON.parse(authRaw).token : '';
    if (token) {
      await page.request.post('http://localhost:4001/api/simulator/reset', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    // Navigate to Simulator
    await page.goto('/admin/simulator');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    // 1. Initial State: Launch Swarm enabled, Reset button disabled
    const launchBtn = page.getByRole('button', { name: /Launch Swarm/i });
    const resetBtn = page.getByTestId('simulator-reset-btn');

    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toBeEnabled();

    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeDisabled();

    // 2. Launch Swarm
    await launchBtn.click();

    // Wait for simulation to run and produce non-zero candidates / activity
    await expect(page.getByText(/Simulated Candidates \([1-9]\d*\)/)).toBeVisible({
      timeout: 20000,
    });
    await expect(resetBtn).toBeEnabled({ timeout: 10000 });

    // Wait for some answers or infractions to be recorded
    await page.waitForTimeout(3000);

    // 3. Click Reset button to open confirmation modal
    await resetBtn.click();

    const modalTitle = page.getByText('Reset simulator?', { exact: true });
    await expect(modalTitle).toBeVisible();

    const modalBody = page.getByText(
      'This stops the swarm and clears the simulated candidates and activity. Existing real data is not affected.'
    );
    await expect(modalBody).toBeVisible();

    // Modal action buttons: Cancel and Reset inside the dialog
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    const modalCancel = modal.getByRole('button', { name: 'Cancel', exact: true });
    const modalReset = modal.getByRole('button', { name: 'Reset', exact: true });

    await expect(modalCancel).toBeVisible();
    await expect(modalReset).toBeVisible();

    // 4. Confirm Reset
    await modalReset.click();

    // Wait for success toast and dialog close
    await expect(page.getByText('Simulator reset')).toBeVisible({ timeout: 15000 });
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 5. Assert UI is reset to initial zero state
    // Counters at 0
    await expect(page.getByText('No active candidate swarm running.')).toBeVisible();
    await expect(page.getByText('Awaiting simulation events...')).toBeVisible();

    // Launch Swarm is enabled again, Reset is disabled
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toBeEnabled();
    await expect(resetBtn).toBeDisabled();

    // Verify control defaults restored
    const candidateSlider = page.locator('input[type="range"]').first();
    await expect(candidateSlider).toHaveValue('12');

    // 6. Verify Live Monitor no longer shows virtual candidates
    const proctorPage = await context.newPage();
    await proctorPage.goto('/proctor');
    await proctorPage.waitForLoadState('domcontentloaded');
    await proctorPage.waitForTimeout(1000);

    const virtualCards = proctorPage.locator('text=/virtual\\.candidate\\./');
    expect(await virtualCards.count()).toBe(0);

    const virtualNames = proctorPage.locator('text=/Virtual Candidate/');
    expect(await virtualNames.count()).toBe(0);

    await proctorPage.close();

    // 7. Re-launch after reset to verify it starts cleanly from 0
    await launchBtn.click();
    await expect(page.getByText(/Simulated Candidates \([1-9]\d*\)/)).toBeVisible({
      timeout: 20000,
    });

    // Clean up: halt and reset so database is pristine
    await page.waitForTimeout(1000);
    const haltBtn = page.getByRole('button', { name: /Halt Swarm/i });
    if (await haltBtn.isVisible()) {
      await haltBtn.click();
    }
    await resetBtn.click();
    const finalModal = page.getByRole('dialog');
    const finalModalReset = finalModal.getByRole('button', { name: 'Reset', exact: true });
    if (await finalModalReset.isVisible()) {
      await finalModalReset.click();
      await expect(page.getByText('Simulator reset')).toBeVisible({ timeout: 15000 });
    }
  });
});
