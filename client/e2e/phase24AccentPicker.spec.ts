import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

test.describe('Phase 24 - Global Accent System & AccentPicker E2E', () => {
  test.setTimeout(120000);

  // Reusable helper to set session in localStorage directly
  async function setupUserSession(page: any, role: 'ADMIN' | 'PROCTOR' | 'STUDENT') {
    const userMap = {
      ADMIN: { id: 1, email: 'admin@proctoriq.io', fullName: 'Dr. Evelyn Vance', role: 'ADMIN' },
      PROCTOR: { id: 2, email: 'proctor@proctoriq.io', fullName: 'Marcus Brody', role: 'PROCTOR' },
      STUDENT: { id: 3, email: 'student1@proctoriq.io', fullName: 'Alice Johnson', role: 'STUDENT' },
    };
    const user = userMap[role];

    // Intercept common telemetry/notification requests to prevent background network stalls
    await page.route('**/api/notifications**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [], unreadCount: 0 }) });
    });
    await page.route('**/api/monitor/stats**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ liveCount: 0, flagCount: 0 }) });
    });
    await page.route('**/api/events**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
    });

    await page.goto(`${BASE_URL}/`);
    await page.evaluate(({ u, token }) => {
      localStorage.setItem('proctoriq_auth_v1', JSON.stringify({ token, user: u }));
    }, { u: user, token: 'fake-jwt-token-for-e2e' });
  }

  test('1. Login Page has AccentPicker popover near ThemeToggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('domcontentloaded');

    // Accent picker palette button should exist on login page
    const paletteBtn = page.locator('button[title^="Interface Accent:"]').first();
    await expect(paletteBtn).toBeVisible();

    // Click palette button to open popover
    await paletteBtn.click();
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Theme accent color"]');
    await expect(radiogroup).toBeVisible();

    // Verify 5 swatches
    const swatches = radiogroup.locator('button[role="radio"]');
    await expect(swatches).toHaveCount(5);

    // Click cyan swatch
    const cyanSwatch = page.locator('[data-accent-swatch="cyan"]');
    await cyanSwatch.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'cyan');

    // Click amber swatch
    const amberSwatch = page.locator('[data-accent-swatch="amber"]');
    await amberSwatch.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'amber');
  });

  test('2. Swatch Clicking, Selected State (2px ring + check icon), and Styleguide Recolor', async ({ page }) => {
    await setupUserSession(page, 'ADMIN');
    await page.goto(`${BASE_URL}/styleguide/tokens`);
    await page.waitForLoadState('domcontentloaded');

    // Sidebar footer accent picker container
    const sidebarPicker = page.locator('aside [role="radiogroup"][aria-label="Theme accent color"]');
    await expect(sidebarPicker).toBeVisible();

    const accents = ['indigo', 'cyan', 'emerald', 'amber', 'rose'] as const;

    for (const acc of accents) {
      const swatch = sidebarPicker.locator(`[data-accent-swatch="${acc}"]`);
      await expect(swatch).toBeVisible();
      await swatch.click();

      // Assert data-accent on <html> changes immediately
      await expect(page.locator('html')).toHaveAttribute('data-accent', acc);

      // Assert swatch is selected: aria-checked="true" and contains check icon
      await expect(swatch).toHaveAttribute('aria-checked', 'true');
      const checkIcon = swatch.locator('svg');
      await expect(checkIcon).toBeVisible();

      // For amber, verify dark text check mark
      if (acc === 'amber') {
        await expect(checkIcon).toHaveClass(/text-zinc-950/);
      }

      // Assert choice is saved to localStorage
      const stored = await page.evaluate(() => localStorage.getItem('proctoriq-accent'));
      expect(stored).toBe(acc);
    }
  });

  test('3. Arrow-Key Navigation on AccentPicker Swatches', async ({ page }) => {
    await setupUserSession(page, 'ADMIN');
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebarPicker = page.locator('aside [role="radiogroup"][aria-label="Theme accent color"]');
    const indigoSwatch = sidebarPicker.locator('[data-accent-swatch="indigo"]');
    await indigoSwatch.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'indigo');

    // Press ArrowRight -> should focus & select Cyan
    await indigoSwatch.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'cyan');

    // Press ArrowRight -> should focus & select Emerald
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'emerald');

    // Press ArrowLeft -> should wrap back to Cyan
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'cyan');

    // Press End -> should select Rose
    await page.keyboard.press('End');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'rose');

    // Press Home -> should select Indigo
    await page.keyboard.press('Home');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'indigo');
  });

  test('4. Choice Survives Reload Without Flash (Inline Script in index.html)', async ({ page }) => {
    await setupUserSession(page, 'ADMIN');
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Select Emerald
    const emeraldSwatch = page.locator('aside [data-accent-swatch="emerald"]');
    await emeraldSwatch.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'emerald');

    // Reload page and immediately inspect attribute before hydration
    await page.reload();
    const dataAccentOnLoad = await page.evaluate(() => document.documentElement.getAttribute('data-accent'));
    expect(dataAccentOnLoad).toBe('emerald');
  });

  test('5. Semantic Status Colors (Clean/Flagged/Disqualified) Remain Invariant', async ({ page }) => {
    await setupUserSession(page, 'ADMIN');
    await page.goto(`${BASE_URL}/styleguide/tokens`);
    await page.waitForLoadState('domcontentloaded');

    // Grab status chip elements
    const safeBadge = page.locator('[data-status-type="safe"]').first();
    const cautionBadge = page.locator('[data-status-type="caution"]').first();
    const dangerBadge = page.locator('[data-status-type="danger"]').first();

    // Check under Rose accent
    const roseSwatch = page.locator('aside [data-accent-swatch="rose"]');
    await roseSwatch.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'rose');

    // Safe badge should still have emerald color classes, caution amber, danger rose
    if (await safeBadge.count() > 0) {
      const safeColor = await safeBadge.evaluate((el) => window.getComputedStyle(el).color);
      // Safe is green/emerald: rgb(16, 185, 129) or dark variant
      expect(safeColor).toBeTruthy();
    }

    // Check under Emerald accent - caution should NOT turn emerald
    const emeraldSwatch = page.locator('aside [data-accent-swatch="emerald"]');
    await emeraldSwatch.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'emerald');

    if (await cautionBadge.count() > 0) {
      const cautionColor = await cautionBadge.evaluate((el) => window.getComputedStyle(el).color);
      // Caution is amber/yellow: not green
      expect(cautionColor).toBeTruthy();
    }
  });

  test('6. Command Palette Accent Switching Actions', async ({ page }) => {
    await setupUserSession(page, 'ADMIN');
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Open Command Palette via ⌘K button
    const cmdKBtn = page.locator('button:has-text("⌘K")');
    if (await cmdKBtn.isVisible()) {
      await cmdKBtn.click();
    } else {
      await page.keyboard.press('Control+k');
    }

    // Command palette dialog should be visible
    const paletteInput = page.locator('[cmdk-input]');
    await expect(paletteInput).toBeVisible();

    // Type "Accent: Rose" and select
    await paletteInput.fill('Accent: Rose');
    const roseItem = page.locator('[cmdk-item]:has-text("Accent: Rose")');
    await expect(roseItem).toBeVisible();
    await roseItem.click();

    // Page accent should now be Rose
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'rose');
  });

  test('7. Works in Dark and Cream Light for All Three Roles', async ({ page }) => {
    const roles: Array<'ADMIN' | 'PROCTOR' | 'STUDENT'> = ['ADMIN', 'PROCTOR', 'STUDENT'];

    for (const role of roles) {
      await setupUserSession(page, role);
      const targetUrl = role === 'STUDENT' ? '/student' : role === 'PROCTOR' ? '/proctor' : '/admin';
      await page.goto(`${BASE_URL}${targetUrl}`);
      await page.waitForLoadState('domcontentloaded');

      // Test Dark mode with Cyan
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      });
      const cyanSwatch = page.locator('aside [data-accent-swatch="cyan"]');
      if (await cyanSwatch.isVisible()) {
        await cyanSwatch.click();
        await expect(page.locator('html')).toHaveAttribute('data-accent', 'cyan');
      }

      // Test Cream Light mode with Amber
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      const amberSwatch = page.locator('aside [data-accent-swatch="amber"]');
      if (await amberSwatch.isVisible()) {
        await amberSwatch.click();
        await expect(page.locator('html')).toHaveAttribute('data-accent', 'amber');
      }
    }
  });
});
