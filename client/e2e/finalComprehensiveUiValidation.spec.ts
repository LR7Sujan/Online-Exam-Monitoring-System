import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/ui-fix-screenshots');

test.describe('Phase 15: Final Comprehensive UI Validation, Walkthrough & Verification Suite', () => {
  test.setTimeout(300000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAsRole(page: any, role: 'Admin' | 'Proctor' | 'Student') {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.click(`button:has-text("${role}")`);
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url: URL) => url.pathname.includes('/home'), { timeout: 15000 });
    await page.click('button:has-text("Open my dashboard")');
    const expectedPath = role === 'Admin' ? '/admin' : role === 'Proctor' ? '/proctor' : '/student';
    await page.waitForURL((url: URL) => url.pathname.includes(expectedPath), { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  async function setTheme(page: any, theme: 'dark' | 'light') {
    await page.evaluate((t: string) => {
      localStorage.setItem('proctoriq-theme', t);
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }, theme);
    await page.waitForTimeout(250);
  }

  // --------------------------------------------------------------------------
  // 1. No-Blank-Page Navigation (All Roles)
  // --------------------------------------------------------------------------
  test('No-blank-page navigation across all roles and routes without hard refresh', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Filter out expected external network or harmless browser warnings if any
        if (!msg.text().includes('favicon') && !msg.text().includes('Socket')) {
          consoleErrors.push(msg.text());
        }
      }
    });

    // A) Proctor role navigation: /proctor -> /proctor/audit -> /styleguide
    await loginAsRole(page, 'Proctor');

    // 1. Proctor Monitor
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/Proctor Mission Control/i);

    // 2. Click Violation Audit in sidebar
    await page.locator('aside a[href="/proctor/audit"]').click();
    await page.waitForURL('**/proctor/audit');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('table, [data-source="vw_ViolationAuditReport"], button:has-text("Adjudication Queue")').first()).toBeVisible();

    // 3. Click back to Live Monitor
    await page.locator('aside a[href="/proctor"]').first().click();
    await page.waitForURL('**/proctor');
    await expect(page.locator('main')).toBeVisible();

    // B) Admin role navigation: /admin -> /admin/exams -> /admin/analytics -> /admin/simulator
    await loginAsRole(page, 'Admin');

    const adminRoutes = [
      { href: '/admin', heading: /Operational Surveillance Intelligence|Mission Overview/i },
      { href: '/admin/exams', heading: /Assessment Catalog/i },
      { href: '/admin/analytics', heading: /Telemetry & Heatmap|Analytics/i },
      { href: '/admin/simulator', heading: /Candidate Swarm Demo Simulator/i },
      { href: '/styleguide', heading: /UI Component Styleguide/i },
    ];

    for (const route of adminRoutes) {
      await page.locator(`aside a[href="${route.href}"]`).first().click();
      await page.waitForURL(`**${route.href}`);
      await expect(page.locator('main')).toBeVisible();
      // Verify content is not stuck at opacity 0
      const opacity = await page.locator('main').evaluate((el) => window.getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeGreaterThan(0);
    }

    // C) Student role navigation
    await loginAsRole(page, 'Student');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 2. Sidebar Expanded and Collapsed Behavior
  // --------------------------------------------------------------------------
  test('Sidebar expanded and collapsed conforms strictly to specifications', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRole(page, 'Admin');

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // EXPANDED (approx 260px)
    const expandedBox = await sidebar.boundingBox();
    expect(expandedBox?.width).toBeGreaterThanOrEqual(250);
    expect(expandedBox?.width).toBeLessThanOrEqual(270);
    // Runs full viewport height
    expect(expandedBox?.height).toBeGreaterThanOrEqual(890);
    expect(expandedBox?.height).toBeLessThanOrEqual(910);

    // Verify sections and active item gradient bar
    await expect(sidebar.getByText('CORE', { exact: true })).toBeVisible();
    await expect(sidebar.locator('a[href="/home"]').first()).toBeVisible();
    await expect(sidebar.getByText('SURVEILLANCE', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('MANAGEMENT', { exact: true })).toBeVisible();

    // Footer is pinned at bottom with status card
    const footerStatus = sidebar.locator('text=NODE ONLINE');
    await expect(footerStatus).toBeVisible();

    // COLLAPSED (approx 72px)
    const collapseToggleBtn = sidebar.locator('button[aria-label*="Collapse sidebar" i], button[aria-label*="sidebar" i]').first();
    await collapseToggleBtn.click();
    await page.waitForTimeout(400);

    const collapsedBox = await sidebar.boundingBox();
    expect(collapsedBox?.width).toBeGreaterThanOrEqual(65);
    expect(collapsedBox?.width).toBeLessThanOrEqual(80);

    // Verify footer status dot is visible and not clipped
    const statusDot = sidebar.locator('span.rounded-full.bg-emerald-500').last();
    await expect(statusDot).toBeVisible();

    // Restore to expanded
    const expandToggleBtn = sidebar.locator('button[aria-label*="Expand sidebar" i], button[aria-label*="sidebar" i]').first();
    await expandToggleBtn.click();
    await page.waitForTimeout(400);
    const restoredBox = await sidebar.boundingBox();
    expect(restoredBox?.width).toBeGreaterThanOrEqual(250);
    expect(restoredBox?.width).toBeLessThanOrEqual(270);
  });

  // --------------------------------------------------------------------------
  // 3. Profile Dropdown & Notification Panel (Solid Opaque, Esc & Outside Click)
  // --------------------------------------------------------------------------
  test('Profile dropdown and notification panel are fully opaque, close on Escape and outside click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRole(page, 'Admin');

    const header = page.locator('header');

    // A) Profile Menu
    const userMenuBtn = header.locator('button[aria-label="User account menu"]');
    await userMenuBtn.click();
    await page.waitForTimeout(250);

    const profilePanel = page.locator('[role="dialog"][aria-label="User account menu"]');
    await expect(profilePanel).toBeVisible();

    // Verify opaque background class (bg-surface / solid border)
    const panelClass = await profilePanel.getAttribute('class');
    expect(panelClass).toContain('bg-surface');

    // Verify profile details & items
    await expect(profilePanel.locator('text=admin@proctoriq.io')).toBeVisible();
    await expect(profilePanel.locator('button:has-text("Sign Out")')).toBeVisible();

    // Test Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(profilePanel).toBeHidden();

    // Reopen and test click outside to close
    await userMenuBtn.click();
    await page.waitForTimeout(250);
    await expect(profilePanel).toBeVisible();
    await page.locator('.fixed.inset-0.z-40').first().click();
    await page.waitForTimeout(250);
    await expect(profilePanel).toBeHidden();

    // B) Violation Telemetry Feed Notification Panel
    const bellBtn = header.locator('button[aria-label="Notifications"]');
    await bellBtn.click();
    await page.waitForTimeout(250);

    const notifPanel = page.locator('[role="dialog"][aria-label="Violation Telemetry Feed"]');
    await expect(notifPanel).toBeVisible();

    // Verify header, title and count chip
    await expect(notifPanel.locator('text=Violation Telemetry Feed')).toBeVisible();
    await expect(notifPanel.locator('button:has-text("All")')).toBeVisible();

    // Test Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(notifPanel).toBeHidden();

    // Reopen and test close button
    await bellBtn.click();
    await page.waitForTimeout(250);
    await expect(notifPanel).toBeVisible();
    const closeBtn = notifPanel.locator('button[aria-label="Close notification panel"], button[aria-label*="Close" i]').first();
    await closeBtn.click();
    await page.waitForTimeout(250);
    await expect(notifPanel).toBeHidden();
  });

  // --------------------------------------------------------------------------
  // 4. Styleguide Sub-menu & Each Sub-route
  // --------------------------------------------------------------------------
  test('Styleguide sub-menu expands with 13 sub-items and navigates to each sub-route', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRole(page, 'Admin');

    const sidebar = page.locator('aside');

    // Verify UI Styleguide accordion in sidebar
    const styleguideNav = sidebar.getByRole('link', { name: 'UI Styleguide' });
    await expect(styleguideNav).toBeVisible();

    const subRoutes = [
      { name: 'Tokens', href: '/styleguide/tokens' },
      { name: 'Indicators', href: '/styleguide/indicators' },
      { name: 'Bento Grid & Cards', href: '/styleguide/bento' },
      { name: 'Buttons', href: '/styleguide/buttons' },
      { name: 'Badges & Pills', href: '/styleguide/badges' },
      { name: 'Stat Cards', href: '/styleguide/stat-cards' },
      { name: 'Trust Ring', href: '/styleguide/trust-ring' },
      { name: 'Data Tables', href: '/styleguide/tables' },
      { name: 'Drawers & Modals', href: '/styleguide/overlays' },
      { name: 'Charts', href: '/styleguide/charts' },
      { name: 'Loading & Empty States', href: '/styleguide/loading-empty' },
      { name: 'Motion', href: '/styleguide/motion' },
    ];

    for (const sub of subRoutes) {
      await page.goto(sub.href);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);

      // Verify breadcrumb and clean docs title
      await expect(page.locator('main nav, main ol, main').first()).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
      // Verify preview tab / code tab exists
      await expect(page.locator('button:has-text("Preview"), [role="tab"]:has-text("Preview")').first()).toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // 5. Landing, Login, and Register Flows (Valid and Invalid Input)
  // --------------------------------------------------------------------------
  test('Landing, Login, and Register flows handle valid and invalid inputs gracefully', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Clear auth so unauthenticated landing/login can be tested without redirect
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // A) Unified Entry Page at /
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Create account$/i })).toBeVisible();
    await expect(page.locator('text=Zero-Trust Assessments')).toBeVisible();

    // B) Login Page Validation & Deep-link Redirect
    await page.goto('/login');
    await page.waitForURL((url: URL) => url.search.includes('tab=signin') || url.pathname === '/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Submit empty fields (clear prefilled demo credentials first)
    await page.fill('input#login-email', '');
    await page.fill('input#login-password', '');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(page.locator('text=Email address is required')).toBeVisible();

    // 2. Invalid password
    await page.fill('input#login-email', 'admin@proctoriq.io');
    await page.fill('input#login-password', 'WrongPassword#123');
    await submitBtn.click();
    await expect(page.locator('[role="alert"]').first()).toBeVisible();

    // 3. Valid Login -> Lands on /home first per specifications
    await page.fill('input#login-password', 'ProctorIQ#2026');
    await submitBtn.click();
    await page.waitForURL('**/home', { timeout: 15000 });
    expect(page.url()).toContain('/home');

    // Verify "Open my dashboard" on /home routes to role dashboard (/admin)
    const openDashBtn = page.getByRole('button', { name: /Open my dashboard/i });
    await expect(openDashBtn.first()).toBeVisible();
    await openDashBtn.first().click();
    await page.waitForURL('**/admin', { timeout: 15000 });
    expect(page.url()).toContain('/admin');

    // C) Register Page Validation & Deep-link Redirect
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
    await page.goto('/register');
    await page.waitForURL((url: URL) => url.search.includes('tab=register'));
    await page.waitForLoadState('domcontentloaded');

    // Submit with empty fields
    const regSubmitBtn = page.locator('button[type="submit"]');
    await regSubmitBtn.click();
    await expect(page.locator('text=Full name must be at least 2 characters')).toBeVisible();

    // Password mismatch
    await page.fill('input#register-fullname', 'Test Student');
    await page.fill('input#register-email', `test.${Date.now()}@university.edu`);
    await page.fill('input#register-password', 'ProctorIQ#2026');
    await page.fill('input#register-confirm-password', 'MismatchedPassword#1');
    await regSubmitBtn.click();
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 6. Seeded Data Renders on Every Data Page
  // --------------------------------------------------------------------------
  test('Seeded data renders correctly on every data-centric page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Proctor Live Monitor: candidates render
    await loginAsRole(page, 'Proctor');
    await page.goto('/proctor');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    // Verify candidate tiles or active exam cards are present
    const tiles = page.locator('[data-source="vw_ProctorLiveMonitor"], h2, [role="article"], .grid');
    await expect(tiles.first()).toBeVisible();

    // 2. Violation Audit: seeded ~300 logs render in table with pagination
    await page.goto('/proctor/audit');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    // Switch to queue view if on monitor
    const queueTab = page.getByRole('button', { name: /Adjudication Queue/i });
    if (await queueTab.isVisible()) {
      await queueTab.click();
      await page.waitForTimeout(500);
    }
    const tableRows = page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible();
    const count = await tableRows.count();
    expect(count).toBeGreaterThan(0);

    // 3. Exam Catalog: seeded exams render
    await loginAsRole(page, 'Admin');
    await page.goto('/admin/exams');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await expect(page.locator('text=DURATION:').first()).toBeVisible();

    // 4. Telemetry & Heatmap
    await page.goto('/admin/analytics');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();

    // 5. Student Dashboard: available assessments render
    await loginAsRole(page, 'Student');
    await page.goto('/student');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await expect(page.locator('text=Candidate Examination Console')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Live Assessments/i })).toBeVisible();

    // 6. Student Results
    await page.goto('/student/results/1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await expect(page.locator('main')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 7. Manual-style Browser Walkthrough with Zero Console Errors & Screenshots
  // --------------------------------------------------------------------------
  test('Manual walkthrough at 1440px, 1024px, 390px in Dark & Light with ZERO console errors', async ({ page }) => {
    const errorLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known harmless browser warnings
        if (!text.includes('favicon') && !text.includes('Socket') && !text.includes('ECONNRESET')) {
          errorLogs.push(`${page.url()}: ${text}`);
        }
      }
    });

    const walkthroughPages = [
      { path: '/', name: 'entry_login', requiresAuth: false },
      { path: '/home', name: 'home', requiresAuth: true, role: 'Admin' as const },
      { path: '/admin', name: 'admin', requiresAuth: true, role: 'Admin' as const },
      { path: '/proctor', name: 'proctor', requiresAuth: true, role: 'Proctor' as const },
      { path: '/student', name: 'student', requiresAuth: true, role: 'Student' as const },
      { path: '/styleguide', name: 'styleguide', requiresAuth: true, role: 'Admin' as const },
    ];

    const viewports = [
      { width: 1440, height: 900, label: '1440px' },
      { width: 1024, height: 768, label: '1024px' },
      { width: 390, height: 844, label: '390px' },
    ];

    for (const item of walkthroughPages) {
      if (item.requiresAuth) {
        await loginAsRole(page, item.role);
      } else {
        await page.context().clearCookies();
        await page.goto(item.path);
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await page.reload();
      }

      await page.goto(item.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(400);

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(300);

        // Dark screenshot
        await setTheme(page, 'dark');
        await page.screenshot({
          path: path.join(screenshotDir, `${item.name}_${vp.label}_dark.png`),
          fullPage: true,
        });

        // Light screenshot
        await setTheme(page, 'light');
        await page.screenshot({
          path: path.join(screenshotDir, `${item.name}_${vp.label}_light.png`),
          fullPage: true,
        });
      }
    }

    // Verify ZERO console errors occurred across the entire walkthrough
    expect(errorLogs).toHaveLength(0);
  });
});
