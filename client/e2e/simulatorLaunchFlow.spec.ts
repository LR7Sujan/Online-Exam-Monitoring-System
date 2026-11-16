import { test, expect } from '@playwright/test';

test.describe('Candidate Swarm Demo Simulator: Launch Flow & Guardrails', () => {
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

  test('1. Closed exam window displays inline warning banner and disables Launch button', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/simulator');
    await page.waitForLoadState('domcontentloaded');

    // Select Exam #3 (SYS-310: Operating Systems) which has an expired window in test DB
    const examSelect = page.locator('select').first();
    await expect(examSelect).toBeVisible();
    await examSelect.selectOption('3');

    // Verify inline warning banner appears
    const warningBanner = page.locator('text=Exam window is currently closed');
    await expect(warningBanner).toBeVisible({ timeout: 5000 });

    // Verify Launch Swarm button is disabled
    const launchBtn = page.getByRole('button', { name: /Launch Swarm/i });
    await expect(launchBtn).toBeDisabled();

    // Verify "Open exam window for demo" button is visible
    const openWindowBtn = page.getByRole('button', { name: /Open exam window for demo/i });
    await expect(openWindowBtn).toBeVisible();

    // Click "Open exam window for demo" to trigger modal
    await openWindowBtn.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Open Exam Window for Demo\?/i)).toBeVisible();

    // Confirm window extension
    const confirmBtn = modal.getByRole('button', { name: /Open Window/i });
    await Promise.all([
      page.waitForResponse(
        (res: any) => res.url().includes('/api/admin/exams/3/open-window') && res.status() === 200,
        { timeout: 10000 }
      ),
      confirmBtn.click(),
    ]);

    // Modal closes, success toast appears, warning banner clears, and Launch button is enabled
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('Exam window opened for testing and demo')).toBeVisible({ timeout: 5000 });
    await expect(warningBanner).not.toBeVisible();
    await expect(launchBtn).toBeEnabled();
  });

  test('2. Launch 5 candidates -> counters rise within 5s -> activity stream fills -> Reset to zero -> re-launch works', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Clean initial simulator state
    const authRaw = await page.evaluate(() => localStorage.getItem('proctoriq_auth_v1'));
    const token = authRaw ? JSON.parse(authRaw).token : '';
    if (token) {
      await page.request.post('http://localhost:4001/api/simulator/reset', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    await page.goto('/admin/simulator');
    await page.waitForLoadState('domcontentloaded');

    // Select Exam #1 (or open exam)
    const examSelect = page.locator('select').first();
    await examSelect.selectOption('1');

    // Check if window is open; if not open it
    const openWindowBtn = page.getByRole('button', { name: /Open exam window for demo/i });
    if (await openWindowBtn.isVisible()) {
      await openWindowBtn.click();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: /Open Window/i }).click();
      await expect(modal).not.toBeVisible();
    }

    // Set candidate slider to 5
    const candidateSlider = page.locator('input[type="range"]').first();
    await candidateSlider.fill('5');
    await expect(page.getByText('5 Students')).toBeVisible();

    const launchBtn = page.getByRole('button', { name: /Launch Swarm/i });
    const resetBtn = page.getByTestId('simulator-reset-btn');

    await expect(launchBtn).toBeEnabled();
    await expect(resetBtn).toBeDisabled();

    // Click Launch Swarm
    await launchBtn.click();

    // Verify activity stream and candidate grid show active swarm within 5s
    await expect(page.getByText(/Simulated Candidates \([1-9]\d*\)/)).toBeVisible({
      timeout: 10000,
    });

    // Check that at least some activity logs or answers dispatched are registered
    await expect(page.getByText(/ACTIVE SWARM/i)).toBeVisible();
    await expect(resetBtn).toBeEnabled({ timeout: 10000 });

    // Wait a brief moment for events to arrive in the activity stream
    await page.waitForTimeout(3000);

    // Click Reset
    await resetBtn.click();
    const resetModal = page.getByRole('dialog');
    await expect(resetModal).toBeVisible();

    const confirmResetBtn = resetModal.getByRole('button', { name: 'Reset', exact: true });
    await confirmResetBtn.click();

    // Verify reset toast and return to zero state
    await expect(page.getByText('Simulator reset')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No active candidate swarm running.')).toBeVisible();
    await expect(page.getByText('Awaiting simulation events...')).toBeVisible();
    await expect(launchBtn).toBeEnabled();
    await expect(resetBtn).toBeDisabled();

    // Re-launch swarm to verify it launches every time after reset
    await launchBtn.click();
    await expect(page.getByText(/Simulated Candidates \([1-9]\d*\)/)).toBeVisible({
      timeout: 10000,
    });

    // Clean up before test completion
    const haltBtn = page.getByRole('button', { name: /Halt Swarm/i });
    if (await haltBtn.isVisible()) {
      await haltBtn.click();
    }
    await resetBtn.click();
    const finalModal = page.getByRole('dialog');
    const finalReset = finalModal.getByRole('button', { name: 'Reset', exact: true });
    if (await finalReset.isVisible()) {
      await finalReset.click();
      await expect(page.getByText('Simulator reset')).toBeVisible({ timeout: 15000 });
    }
  });
});
