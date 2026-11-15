import { test, expect, type Page, type CDPSession } from '@playwright/test';

test.describe('Fail-Safe Route Transitions: Visible-By-Default Navigation', () => {
  test.setTimeout(300000); // 5 minutes

  async function expectRendered(page: Page, consoleErrors: string[]) {
    // Poll up to 4s for main container to be rendered with opacity > 0.9, height > 200, and a visible title
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const m = document.querySelector('main');
        if (!m) return { ok: false, reason: 'no main' };

        const mStyle = window.getComputedStyle(m);
        const mOpacity = parseFloat(mStyle.opacity);
        if (mOpacity < 0.9) return { ok: false, reason: `low opacity ${mOpacity}` };

        const rect = m.getBoundingClientRect();
        if (rect.height <= 200) return { ok: false, reason: `height ${rect.height} <= 200` };

        // Search for title elements inside main (h1, h2, or data-testid="page-title")
        const candidates = Array.from(document.querySelectorAll('main h1, main h2, [data-testid="page-title"]'));
        for (const el of candidates) {
          const text = (el.textContent || '').trim();
          const style = window.getComputedStyle(el);
          const opacity = parseFloat(style.opacity);
          const visibility = style.visibility;
          if (text.length > 3 && opacity >= 0.9 && visibility === 'visible') {
            return { ok: true, text };
          }
        }

        return { ok: false, reason: `no visible title, candidates count: ${candidates.length}` };
      });
    }, {
      message: 'Expected main container to be rendered with opacity > 0.9, height > 200, and visible title',
      timeout: 8000,
    }).toMatchObject({ ok: true });

    // 4. zero uncaught console errors
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('Download the React DevTools') &&
        !err.includes('favicon.ico') &&
        !err.includes('MediaPipe') &&
        !err.includes('socket.io')
    );
    expect(fatalErrors).toEqual([]);
  }

  async function setupConsoleListener(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }

  async function loginAs(page: Page, email: string) {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(300);
  }

  test('ADMIN: 5 passes normal and 5 passes throttled across all 7 routes', async ({ page }) => {
    const errors = await setupConsoleListener(page);
    await loginAs(page, 'admin@proctoriq.io');

    const adminRoutes = [
      { name: 'Mission Overview', selector: 'aside a[href="/admin"]' },
      { name: 'Live Monitor', selector: 'aside a[href="/proctor"]' },
      { name: 'Violation Audit', selector: 'aside a[href="/proctor/audit"]' },
      { name: 'Exam Catalog', selector: 'aside a[href="/admin/exams"]' },
      { name: 'Telemetry & Heatmap', selector: 'aside a[href="/admin/analytics"]' },
      { name: 'Demo Simulator', selector: 'aside a[href="/admin/simulator"]' },
      { name: 'Home', selector: 'aside a[href="/home"]' },
    ];

    // Part A: 5 Normal Passes
    for (let pass = 1; pass <= 5; pass++) {
      for (const route of adminRoutes) {
        await page.locator(route.selector).first().click();
        await expectRendered(page, errors);
      }
    }

    // Part B: 5 CPU Throttled 4x Passes with 50ms delay
    let cdp: CDPSession | null = null;
    try {
      cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } catch {
      // CDP not available in non-chromium
    }

    for (let pass = 1; pass <= 5; pass++) {
      for (const route of adminRoutes) {
        await page.locator(route.selector).first().click();
        await page.waitForTimeout(50);
        await expectRendered(page, errors);
      }
    }

    if (cdp) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  });

  test('PROCTOR: 5 passes normal and 5 passes throttled across all 3 routes', async ({ page }) => {
    const errors = await setupConsoleListener(page);
    await loginAs(page, 'proctor@proctoriq.io');

    const proctorRoutes = [
      { name: 'Live Monitor', selector: 'aside a[href="/proctor"]' },
      { name: 'Violation Audit', selector: 'aside a[href="/proctor/audit"]' },
      { name: 'Home', selector: 'aside a[href="/home"]' },
    ];

    // Part A: 5 Normal Passes
    for (let pass = 1; pass <= 5; pass++) {
      for (const route of proctorRoutes) {
        await page.locator(route.selector).first().click();
        await expectRendered(page, errors);
      }
    }

    // Part B: 5 Throttled Passes
    let cdp: CDPSession | null = null;
    try {
      cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } catch {}

    for (let pass = 1; pass <= 5; pass++) {
      for (const route of proctorRoutes) {
        await page.locator(route.selector).first().click();
        await page.waitForTimeout(50);
        await expectRendered(page, errors);
      }
    }

    if (cdp) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  });

  test('STUDENT: 5 passes normal and 5 passes throttled across routes', async ({ page }) => {
    const errors = await setupConsoleListener(page);
    await loginAs(page, 'student@proctoriq.io');

    const studentRoutes = [
      { name: 'Exams & Portal', selector: 'aside a[href="/student"]' },
      { name: 'Home', selector: 'aside a[href="/home"]' },
    ];

    // Part A: 5 Normal Passes
    for (let pass = 1; pass <= 5; pass++) {
      for (const route of studentRoutes) {
        await page.locator(route.selector).first().click();
        await expectRendered(page, errors);
      }
    }

    // Part B: 5 Throttled Passes
    let cdp: CDPSession | null = null;
    try {
      cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } catch {}

    for (let pass = 1; pass <= 5; pass++) {
      for (const route of studentRoutes) {
        await page.locator(route.selector).first().click();
        await page.waitForTimeout(50);
        await expectRendered(page, errors);
      }
    }

    if (cdp) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  });

  test('Double clicking same route link does not go blank', async ({ page }) => {
    const errors = await setupConsoleListener(page);
    await loginAs(page, 'admin@proctoriq.io');

    const link = page.locator('aside a[href="/admin/simulator"]').first();
    await link.click();
    await expectRendered(page, errors);

    // Click again immediately
    await link.click();
    await expectRendered(page, errors);

    // Click home twice
    const homeLink = page.locator('aside a[href="/home"]').first();
    await homeLink.click();
    await expectRendered(page, errors);
    await homeLink.click();
    await expectRendered(page, errors);
  });

  test('Browser Back and Forward buttons do not go blank', async ({ page }) => {
    const errors = await setupConsoleListener(page);
    await loginAs(page, 'admin@proctoriq.io');

    // Navigate across 3 routes
    await page.locator('aside a[href="/home"]').first().click();
    await expectRendered(page, errors);

    await page.locator('aside a[href="/admin/exams"]').first().click();
    await expectRendered(page, errors);

    await page.locator('aside a[href="/admin/simulator"]').first().click();
    await expectRendered(page, errors);

    // Back twice
    await page.goBack();
    await expectRendered(page, errors);

    await page.goBack();
    await expectRendered(page, errors);

    // Forward twice
    await page.goForward();
    await expectRendered(page, errors);

    await page.goForward();
    await expectRendered(page, errors);
  });

  test('ADMIN: New Routes (/admin/exams, /admin/exams/:id, questions page) render visible with zero blank pages (normal and throttled passes)', async ({
    page,
  }) => {
    const errors = await setupConsoleListener(page);
    await loginAs(page, 'admin@proctoriq.io');

    // Part A: Normal Navigation across /admin/exams, /admin/exams/:id, and questions inspection
    for (let pass = 1; pass <= 3; pass++) {
      // 1. Navigate to /admin/exams
      await page.locator('aside a[href="/admin/exams"]').first().click();
      await page.waitForURL(/\/admin\/exams/, { timeout: 10000 });
      await expectRendered(page, errors);
      await expect(page.locator('text=Curated Assessment Directory')).toBeVisible();

      // 2. Open Questions panel on /admin/exams (if draft exam exists with enabled Inspect Questions)
      const inspectBtn = page.locator('button:has-text("Inspect Questions"):not([disabled])').first();
      const hasDraft = await inspectBtn.isVisible().catch(() => false);
      if (hasDraft) {
        await inspectBtn.click();
        await expect(page.locator('text=Questions Configured')).toBeVisible({ timeout: 5000 });
        await expectRendered(page, errors);
        // Close questions panel
        await page.locator('button:has-text("Close")').first().click();
        await expectRendered(page, errors);
      }

      // 3. Navigate to /admin/exams/:id by clicking the exam card
      const examCards = page.locator('.grid > div.rounded-2xl');
      await expect(examCards.first()).toBeVisible({ timeout: 10000 });
      await examCards.first().click();
      await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });
      await expectRendered(page, errors);

      // Verify detail page & questions bank section are fully rendered
      await expect(page.locator('text=Curated Question Bank')).toBeVisible({ timeout: 5000 });
      await expectRendered(page, errors);

      // 4. Test Browser Back button back to /admin/exams
      await page.goBack();
      await page.waitForURL(/\/admin\/exams/, { timeout: 10000 });
      await expectRendered(page, errors);

      // 5. Test Browser Forward button back to /admin/exams/:id
      await page.goForward();
      await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });
      await expectRendered(page, errors);

      // 6. Direct URL navigation to /admin/exams/:id and back to /admin/exams
      await page.goto('/admin/exams');
      await expectRendered(page, errors);
    }

    // Part B: CPU Throttled 4x Passes across /admin/exams and /admin/exams/:id
    let cdp: CDPSession | null = null;
    try {
      cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } catch {}

    for (let pass = 1; pass <= 3; pass++) {
      // 1. Throttled /admin/exams
      await page.locator('aside a[href="/admin/exams"]').first().click();
      await page.waitForTimeout(50);
      await expectRendered(page, errors);

      // 2. Throttled click card to /admin/exams/:id
      const firstCard = page.locator('.grid > div.rounded-2xl').first();
      await firstCard.click();
      await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });
      await page.waitForTimeout(50);
      await expectRendered(page, errors);

      // Verify question bank loaded under throttled conditions
      await expect(page.locator('text=Curated Question Bank')).toBeVisible({ timeout: 5000 });
      await expectRendered(page, errors);

      // 3. Throttled navigate back to /admin/exams
      await page.locator('aside a[href="/admin/exams"]').first().click();
      await page.waitForTimeout(50);
      await expectRendered(page, errors);
    }

    if (cdp) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  });
});
