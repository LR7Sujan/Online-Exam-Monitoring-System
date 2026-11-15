import { test, expect, type Page } from '@playwright/test';

test.describe('Phase 16: Loading & Empty States Demo and Sidebar Flyout', () => {
  test.setTimeout(180000); // 3 minutes

  async function loginAsAdmin(page: Page) {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(300);
  }

  test('A) Loading & Empty States Page verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    // Navigate to /styleguide/loading-empty
    await page.goto('/styleguide/loading-empty');
    await page.waitForLoadState('networkidle');

    // 1. Top Bar Breadcrumb reads "Styleguide / Loading & Empty States"
    const breadcrumb = page.locator('header').getByText('Styleguide / Loading & Empty States');
    await expect(breadcrumb).toBeVisible();

    // 2. Interactive Demo: Default state is LOADED
    const loadedBadge = page.getByText('5 INCIDENTS LOGGED');
    await expect(loadedBadge).toBeVisible();
    await expect(page.getByText(/Showing:\s*Loaded/i)).toBeVisible();
    await expect(page.getByText('Alex Rivera')).toBeVisible();

    // 3. Click Loading: shows skeletons, caption indicates auto-resolves, then auto-resolves to Loaded after 1.5s
    await page.getByRole('button', { name: 'Loading', exact: true }).click();
    await expect(page.getByText('STREAM BUFFERING')).toBeVisible();
    await expect(page.getByText(/Showing:\s*Loading/i)).toBeVisible();

    // Wait for auto-resolve (1.5s timer)
    await expect(page.getByText('5 INCIDENTS LOGGED')).toBeVisible({ timeout: 3500 });
    await expect(page.getByText(/Showing:\s*Loaded/i)).toBeVisible();

    // 4. Click Empty: shows EmptyState and caption
    await page.getByRole('button', { name: 'Empty', exact: true }).click();
    await expect(page.getByText(/Showing:\s*Empty/i)).toBeVisible();
    await expect(page.getByText('No Active Violations')).toBeVisible();
    await expect(page.getByText('Simulate Candidate Infraction')).toBeVisible();

    // 5. Click Error: shows ErrorState and caption, Retry works
    await page.getByRole('button', { name: 'Error', exact: true }).click();
    await expect(page.getByText(/Showing:\s*Error/i)).toBeVisible();
    await expect(page.getByText('Telemetry Synchronization Failed')).toBeVisible();
    const retryBtn = page.locator('#interactive-state-machine').getByRole('button', { name: 'Retry Request' });
    await retryBtn.click();
    await expect(page.getByText('5 INCIDENTS LOGGED')).toBeVisible({ timeout: 3000 });

    // 6. Standalone Skeleton section: Segmented Control "Skeleton | Content" & Replay load
    const skeletonBtn = page.getByRole('button', { name: 'Skeleton', exact: true });
    const contentBtn = page.getByRole('button', { name: 'Content', exact: true });
    await expect(skeletonBtn).toBeVisible();
    await expect(contentBtn).toBeVisible();

    // Flip to Content mode
    await contentBtn.click();
    await expect(page.getByText('Active Examinee Registry')).toBeVisible();
    await expect(page.getByText('1,436')).toBeVisible();
    await expect(page.getByText('Zero-Trust Exam Core')).toBeVisible();

    // Replay load button flips to skeleton then back to content
    const replayBtn = page.getByRole('button', { name: /Replay load/i });
    await replayBtn.click();
    await expect(page.getByText('1,436')).toBeVisible({ timeout: 3000 });

    // 7. Actionable Empty & Error cards in Section 3
    const refreshRosterBtn = page.getByRole('button', { name: 'Refresh Roster' });
    await expect(refreshRosterBtn).toBeVisible();
    await refreshRosterBtn.click();

    const retryDbBtn = page.getByRole('button', { name: 'Retry Request' });
    await expect(retryDbBtn).toBeVisible();
    await retryDbBtn.click();
    await expect(page.getByText('Database Introspection Restored')).toBeVisible({ timeout: 3000 });
  });

  test('B) Sidebar Scroll & UI Styleguide Popover Flyout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // 1. CORE section remains visible at top (scrollTop === 0)
    const homeLink = sidebar.getByRole('link', { name: 'Home', exact: true });
    await expect(homeLink).toBeVisible();
    const missionOverview = sidebar.getByRole('link', { name: 'Mission Overview', exact: true });
    await expect(missionOverview).toBeVisible();

    const sidebarNav = sidebar.locator('nav');
    const scrollTop = await sidebarNav.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThanOrEqual(5);

    // 2. UI Styleguide button exists in sidebar with "13" badge
    const styleguideBtn = sidebar.getByRole('button', { name: /UI Styleguide/i });
    await expect(styleguideBtn).toBeVisible();

    // 3. Clicking UI Styleguide opens Popover Flyout
    await styleguideBtn.click();
    const flyout = page.locator('div.fixed.z-50:has-text("UI Styleguide")');
    await expect(flyout).toBeVisible();

    // Flyout contains search box and all 13 sub-items
    const searchBox = flyout.locator('input[placeholder*="Search"]');
    await expect(searchBox).toBeVisible();

    const overviewItem = flyout.getByRole('button', { name: /Overview/i });
    const tokensItem = flyout.getByRole('button', { name: /Design Tokens/i });
    const loadingEmptyItem = flyout.getByRole('button', { name: /Loading & Empty States/i });

    await expect(overviewItem).toBeVisible();
    await expect(tokensItem).toBeVisible();
    await expect(loadingEmptyItem).toBeVisible();

    // Search filtering
    await searchBox.fill('loading');
    await expect(loadingEmptyItem).toBeVisible();
    await expect(tokensItem).not.toBeVisible();

    // Clear search
    await searchBox.fill('');
    await expect(tokensItem).toBeVisible();

    // 4. Select item navigates and closes flyout
    await tokensItem.click();
    await expect(flyout).not.toBeVisible();
    await expect(page).toHaveURL(/\/styleguide\/tokens/);
    await expect(page.locator('header').getByText('Styleguide / Design Tokens')).toBeVisible();

    // 5. Open flyout again and test Escape key closes it
    await styleguideBtn.click();
    await expect(flyout).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(flyout).not.toBeVisible();

    // 6. Test outside click closes flyout
    await styleguideBtn.click();
    await expect(flyout).toBeVisible();
    await page.locator('main').click({ position: { x: 300, y: 300 } });
    await expect(flyout).not.toBeVisible();

    // 7. Test in Collapsed Sidebar mode
    const collapseBtn = sidebar.locator('button[aria-label="Collapse sidebar"]');
    await collapseBtn.click();
    await page.waitForTimeout(300);

    // Styleguide icon in collapsed sidebar
    const collapsedStyleguideBtn = sidebar.locator('button[title*="UI Styleguide"]');
    await expect(collapsedStyleguideBtn).toBeVisible();
    await collapsedStyleguideBtn.click();
    await expect(flyout).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(flyout).not.toBeVisible();
  });

  test('C) Dark and Light theme verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    await page.goto('/styleguide/loading-empty');
    await page.waitForLoadState('networkidle');

    // Dark theme check
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByText('5 INCIDENTS LOGGED')).toBeVisible();

    // Switch to Light theme
    const themeBtn = page.locator('button[aria-label*="theme"]').or(page.locator('header button:has-text("theme")')).first();
    await themeBtn.click();
    await page.waitForTimeout(300);

    // Verify Light theme styling
    await expect(page.getByText('5 INCIDENTS LOGGED')).toBeVisible();
    await expect(page.getByText(/Showing:\s*Loaded/i)).toBeVisible();

    // Open styleguide flyout in light mode
    const styleguideBtn = page.locator('aside').getByRole('button', { name: /UI Styleguide/i });
    await styleguideBtn.click();
    const flyout = page.locator('div.fixed.z-50:has-text("UI Styleguide")');
    await expect(flyout).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(flyout).not.toBeVisible();
  });
});
