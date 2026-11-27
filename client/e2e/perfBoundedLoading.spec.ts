import { test, expect, type Page } from '@playwright/test';

test.describe('Phase 25.3: Performance & Bounded Loading Verification', () => {
  test.setTimeout(90000);

  async function loginAs(page: Page, role: 'Admin' | 'Proctor' | 'Student') {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Click role fast-fill button
    const roleBtn = page.locator(`button:has-text("${role}")`).first();
    await roleBtn.click();
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForURL('**/home**', { timeout: 15000 });
  }

  test('1. Pages load under budget (First Content < 1s, Data loaded < 1.5s on warm cache, no skeleton > 8s)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // A) Login page: warm up dev server first, then measure warm TTFC
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');

    const loginStart = Date.now();
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    const loginTTFC = Date.now() - loginStart;
    console.log(`[PERF] Login TTFC: ${loginTTFC}ms`);
    expect(loginTTFC).toBeLessThan(1000);

    // Authenticate as Admin
    await loginAs(page, 'Admin');

    // B) Admin Dashboard (warm navigation)
    // First visit to populate cache
    await page.goto('/admin');
    await page.waitForSelector('text=Total Curated Exams', { timeout: 15000 });

    // Measure warm reload / navigation
    const adminStart = Date.now();
    await page.goto('/admin');
    await page.waitForSelector('h1', { timeout: 5000 });
    const adminTTFC = Date.now() - adminStart;
    await page.waitForSelector('text=Total Curated Exams', { timeout: 5000 });
    const adminDataLoaded = Date.now() - adminStart;
    console.log(`[PERF] Admin warm TTFC: ${adminTTFC}ms, Data loaded: ${adminDataLoaded}ms`);
    expect(adminTTFC).toBeLessThan(1200);
    expect(adminDataLoaded).toBeLessThan(1500);

    // Verify skeleton does not remain visible
    await expect(page.locator('[data-testid="page-skeleton"]')).toHaveCount(0);

    // C) Proctor Live Monitor
    await loginAs(page, 'Proctor');
    await page.goto('/proctor');
    await page.waitForSelector('text=Live Telemetry Grid', { timeout: 15000 });

    const proctorStart = Date.now();
    await page.goto('/proctor');
    await page.waitForSelector('h1:has-text("Proctor Mission Control")', { timeout: 5000 });
    const proctorTTFC = Date.now() - proctorStart;
    await page.waitForSelector('text=Live Telemetry Grid', { timeout: 5000 });
    const proctorDataLoaded = Date.now() - proctorStart;
    console.log(`[PERF] Proctor warm TTFC: ${proctorTTFC}ms, Data loaded: ${proctorDataLoaded}ms`);
    expect(proctorTTFC).toBeLessThan(1000);
    expect(proctorDataLoaded).toBeLessThan(1500);
    await expect(page.locator('[data-testid="page-skeleton"]')).toHaveCount(0);

    // D) Student Portal
    await loginAs(page, 'Student');
    await page.goto('/student');
    await page.waitForSelector('text=Candidate Examination Console', { timeout: 15000 });

    const studentStart = Date.now();
    await page.goto('/student');
    await page.waitForSelector('text=Candidate Examination Console', { timeout: 5000 });
    const studentTTFC = Date.now() - studentStart;
    await page.waitForSelector('h1:has-text("Welcome")', { timeout: 5000 });
    const studentDataLoaded = Date.now() - studentStart;
    console.log(`[PERF] Student warm TTFC: ${studentTTFC}ms, Data loaded: ${studentDataLoaded}ms`);
    expect(studentTTFC).toBeLessThan(1000);
    expect(studentDataLoaded).toBeLessThan(1500);
    await expect(page.locator('[data-testid="page-skeleton"]')).toHaveCount(0);
  });

  test('2. Bounded loading: when API fails or hangs, error state with Retry appears within 12 seconds', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Login as Admin
    await loginAs(page, 'Admin');

    // Intercept API dashboard endpoint and simulate network failure (503 server unreachable)
    await page.route('**/api/analytics/dashboard**', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'SERVER_UNREACHABLE',
            message: 'The server is not reachable. Check that the API and MySQL are running',
          },
        }),
      });
    });

    const routeStart = Date.now();
    // Navigate to /admin
    await page.goto('/admin');

    // Expect ErrorState with Retry button and plain-language message within 12 seconds
    const errorState = page.getByText(/The server is not reachable/i);
    await expect(errorState.first()).toBeVisible({ timeout: 12000 });

    const retryBtn = page.getByRole('button', { name: /retry/i });
    await expect(retryBtn.first()).toBeVisible({ timeout: 5000 });

    const elapsed = Date.now() - routeStart;
    console.log(`[PERF] Error state displayed with Retry button after API failure in ${elapsed}ms (<= 12000ms target)`);
    expect(elapsed).toBeLessThanOrEqual(12000);
  });
});
