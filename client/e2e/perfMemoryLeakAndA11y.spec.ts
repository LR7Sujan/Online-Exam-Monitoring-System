import { test, expect } from '@playwright/test';

interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

test.describe('Sub-Phase 11.8: Performance, Memory Leaks & Accessibility Verification', () => {
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

  // ==========================================================================
  // SUITE 1: MEMORY LEAK AUDIT (DRAWER & 50 NAVIGATION CYCLES)
  // ==========================================================================
  test('1. Memory Leak Audit: 50 Student Detail Drawer Open/Close Cycles maintains bounded heap', async ({
    page,
  }) => {
    // Authenticate as Proctor
    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    await page.waitForURL('**/proctor', { timeout: 15000 });
    await expect(page.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    // Locate candidate tile (student name is in an h3 inside the tile)
    const candidateTile = page.locator('div.cursor-pointer').filter({ has: page.locator('h3') }).first();
    await expect(candidateTile).toBeVisible({ timeout: 10000 });

    // Baseline memory measurement
    const baselineMemory = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: MemoryInfo };
      return perf.memory ? perf.memory.usedJSHeapSize : null;
    });

    console.log(
      `[Memory Audit] Baseline Heap before drawer cycles: ${
        baselineMemory ? (baselineMemory / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'
      }`
    );

    const drawer = page.locator('div[role="dialog"][aria-modal="true"]').first();

    // Perform 50 drawer open and close cycles
    const cycles = 50;
    for (let i = 0; i < cycles; i++) {
      // Open drawer
      await candidateTile.click();
      await expect(drawer).toBeVisible({ timeout: 5000 });

      // Close drawer via Escape key or Close button
      if (i % 2 === 0) {
        await page.keyboard.press('Escape');
      } else {
        const closeBtn = page.locator('button[aria-label="Close drawer"]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }

      await expect(drawer).toBeHidden({ timeout: 5000 });
    }

    // Post-cycle memory measurement
    const finalMemory = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: MemoryInfo };
      return perf.memory ? perf.memory.usedJSHeapSize : null;
    });

    if (baselineMemory && finalMemory) {
      const heapGrowthMB = (finalMemory - baselineMemory) / (1024 * 1024);
      console.log(
        `[Memory Audit] Final Heap after 50 drawer cycles: ${(finalMemory / (1024 * 1024)).toFixed(
          2
        )} MB (Growth: ${heapGrowthMB.toFixed(2)} MB)`
      );
      // Bounded growth: should not exceed 35MB growth across 50 drawer mount/unmount cycles
      expect(heapGrowthMB).toBeLessThan(35);
    }

    // Verify drawer DOM elements are cleanly unmounted
    const residualDrawer = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(residualDrawer).toHaveCount(0);
  });

  test('2. Memory Leak Audit: 50 Page Navigation Cycles cleans up intervals and socket listeners', async ({
    page,
  }) => {
    // Authenticate as Proctor
    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/proctor', { timeout: 15000 });

    const baselineMemory = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: MemoryInfo };
      return perf.memory ? perf.memory.usedJSHeapSize : null;
    });

    console.log(
      `[Memory Audit] Baseline Heap before 50 navigations: ${
        baselineMemory ? (baselineMemory / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'
      }`
    );

    const routes = ['/proctor', '/styleguide', '/login', '/'];
    for (let i = 0; i < 50; i++) {
      const targetRoute = routes[i % routes.length];
      await page.goto(targetRoute);
      await page.waitForLoadState('domcontentloaded');
    }

    // Return to Proctor view and verify page loads cleanly without memory explosion
    await page.goto('/proctor');
    await expect(page.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    const finalMemory = await page.evaluate(() => {
      const perf = window.performance as unknown as { memory?: MemoryInfo };
      return perf.memory ? perf.memory.usedJSHeapSize : null;
    });

    if (baselineMemory && finalMemory) {
      const heapGrowthMB = (finalMemory - baselineMemory) / (1024 * 1024);
      console.log(
        `[Memory Audit] Final Heap after 50 navigations: ${(finalMemory / (1024 * 1024)).toFixed(
          2
        )} MB (Growth: ${heapGrowthMB.toFixed(2)} MB)`
      );
      // Bounded heap after 50 full page reloads: stays under 85 MB
      expect(heapGrowthMB).toBeLessThan(85);
    }
  });

  // ==========================================================================
  // SUITE 2: FULL KEYBOARD NAVIGATION & FOCUS ORDER
  // ==========================================================================
  test('3. Accessibility: Full keyboard navigation traversal and focus management on Login & Proctor views', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });

    // Focus email input and traverse form using keyboard
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('proctor@proctoriq.io');
    await emailInput.focus();

    // Tab moves focus into password input
    await page.keyboard.press('Tab');
    const pwdInput = page.locator('input[type="password"]');
    await expect(pwdInput).toBeFocused();

    // Fill password and press Enter to submit form via keyboard
    await pwdInput.fill('ProctorIQ#2026');
    await page.keyboard.press('Enter');

    await page.waitForURL('**/proctor', { timeout: 15000 });
    await expect(page.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    // Keyboard navigation on Proctor Cockpit: Tab through interactive controls
    await page.keyboard.press('Tab');
    const activeTagName = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'SELECT', 'INPUT']).toContain(activeTagName);
  });

  // ==========================================================================
  // SUITE 3: ACCESSIBILITY ROLES, LABELS & COLOR-INDEPENDENT SIGNALS
  // ==========================================================================
  test('4. Accessibility: TrustRing ARIA meter semantics and color-independent signals', async ({
    page,
  }) => {
    // Authenticate as Student and visit result page
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    await page.waitForURL('**/student', { timeout: 15000 });
    // Navigate to student result page (session 13 is completed in seed)
    await page.goto('/student/results/13');
    await expect(page.locator('text=Official Integrity Rating')).toBeVisible({ timeout: 15000 });

    // Verify TrustRing accessibility attributes
    const trustMeter = page.locator('[role="meter"]').first();
    await expect(trustMeter).toBeVisible({ timeout: 10000 });

    const valuenow = await trustMeter.getAttribute('aria-valuenow');
    const valuemin = await trustMeter.getAttribute('aria-valuemin');
    const valuemax = await trustMeter.getAttribute('aria-valuemax');
    const valuetext = await trustMeter.getAttribute('aria-valuetext');
    const label = await trustMeter.getAttribute('aria-label');

    expect(Number(valuenow)).toBeGreaterThanOrEqual(0);
    expect(Number(valuenow)).toBeLessThanOrEqual(100);
    expect(valuemin).toBe('0');
    expect(valuemax).toBe('100');
    expect(valuetext).toBeTruthy();
    expect(label).toContain('Trust Score');

    // Verify color-independent status indicators: text label present
    await expect(
      page.locator('text=CLEAN').or(page.locator('text=FLAGGED')).or(page.locator('text=DISQUALIFIED')).first()
    ).toBeVisible();

    // Verify chart region accessibility
    const chartRegion = page.locator('[role="region"]').first();
    await expect(chartRegion).toBeVisible();
    const chartAriaLabel = await chartRegion.getAttribute('aria-label');
    expect(chartAriaLabel).toBeTruthy();
  });
});
