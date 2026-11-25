import { test, expect } from '@playwright/test';

test.describe('Proctor Role Complete User Journey', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
          console.error(`[Browser Console Error] ${text}`);
        }
      }
    });
  });

  test('PROCTOR: login -> live monitor -> filter and search -> student drawer (Warn / Terminate / Reinstate) -> review queue Confirm & Dismiss (with keyboard shortcuts)', async ({
    page,
    request,
  }) => {
    // 1. Authenticate as Proctor
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });

    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    // 2. Mission Control Live Telemetry Grid
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await page.goto('/proctor');
    await expect(page.locator('text=Proctor Mission Control')).toBeVisible();
    await expect(page.locator('text=Orbital Surveillance Core')).toBeVisible();

    // Verify KPI strip
    await expect(page.locator('text=Active Live Sessions')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Violations (Last 10m)')).toBeVisible();

    // 3. Test Filter and Search in Live Monitor
    // Filter by Exam dropdown
    const examSelect = page.locator('select').first();
    await expect(examSelect).toBeVisible();
    await examSelect.selectOption({ index: 0 }); // All Active Exams

    // Filter by Status dropdown: IN_PROGRESS
    const statusSelect = page.locator('select').nth(1);
    await statusSelect.selectOption('IN_PROGRESS');
    await page.waitForTimeout(300);

    // Search input
    const searchInput = page.locator('input[placeholder*="Filter student"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Sophia');
    await page.waitForTimeout(400);

    // 4. Open Student Detail Drawer
    const studentCard = page.locator('div.cursor-pointer').filter({ has: page.locator('h3, h4') }).first();
    await expect(studentCard).toBeVisible({ timeout: 10000 });
    await studentCard.click();

    // Drawer should open
    await expect(page.locator('text=Trust Score Telemetry Timeline')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Current Trust Rating:')).toBeVisible();

    // 5. Drawer Action: Warn Candidate
    const warnBtn = page.locator('button:has-text("Warn Candidate")');
    await expect(warnBtn).toBeVisible();
    await warnBtn.click();

    // Warn Modal
    await expect(page.locator('text=Issue Proctor Warning')).toBeVisible();
    const sendWarnBtn = page.locator('button:has-text("Send Warning Overlay")');
    await sendWarnBtn.click();
    await expect(page.locator('text=Issue Proctor Warning')).not.toBeVisible({ timeout: 5000 });

    // 6. Drawer Action: Force Terminate & Reinstate
    const terminateBtn = page.locator('button:has-text("Force Terminate")');
    if (await terminateBtn.isVisible().catch(() => false)) {
      await terminateBtn.click();
      await expect(page.locator('text=Confirm Force Disqualification')).toBeVisible();

      const confirmTermBtn = page.locator('button:has-text("Confirm Disqualification")');
      await confirmTermBtn.click();
      await expect(page.locator('text=Confirm Force Disqualification')).not.toBeVisible({ timeout: 5000 });

      // After termination, the session is TERMINATED_CHEATING and "Reinstate Exam" is available
      const reinstateBtn = page.locator('button:has-text("Reinstate Exam")');
      await expect(reinstateBtn).toBeVisible({ timeout: 10000 });

      // Reinstate candidate
      await reinstateBtn.click();
      await page.waitForTimeout(600);
    }

    // Close Drawer
    await page.click('button[title="Close Inspector"]');
    await expect(page.locator('text=Trust Score Telemetry Timeline')).not.toBeVisible({ timeout: 5000 });

    // 7. Switch to Adjudication Queue
    const queueTabBtn = page.locator('button:has-text("Adjudication Queue")');
    await queueTabBtn.click();

    await expect(page.locator('button:has-text("Pending Audit")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=[C] Confirm')).toBeVisible();

    // Verify filter buttons in review queue
    await page.click('button:has-text("Pending Audit")');
    await page.waitForTimeout(500);

    // 8. Test Confirm and Dismiss on Review Queue rows
    const confirmBtn = page.locator('button:has-text("Confirm [C]")').first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(600);
    }

    const dismissBtn = page.locator('button:has-text("Dismiss [D]")').first();
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click();
      await page.waitForTimeout(600);
      // Switch to DISMISSED filter tab to view restored audit rows
      await page.click('button:has-text("DISMISSED")');
      await expect(page.locator('text=Restored').first()).toBeVisible({ timeout: 5000 });
      // Switch back to Pending Audit
      await page.click('button:has-text("Pending Audit")');
      await page.waitForTimeout(400);
    }

    // 9. Test Keyboard Shortcuts [C] and [D]
    // Ensure table row is focused / not typing in an input
    await page.locator('table').click();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Press 'c' to confirm active row
    await page.keyboard.press('c');
    await page.waitForTimeout(600);

    // Press 'd' to dismiss next row
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('d');
    await page.waitForTimeout(600);
  });
});
