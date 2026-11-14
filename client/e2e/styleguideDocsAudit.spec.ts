import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), '../docs/qa-screenshots');

test.describe('Phase 13: UI Styleguide Documentation Architecture & Navigation Audit', () => {
  test.setTimeout(180000);

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  async function loginAs(page: any, email: string) {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  // --------------------------------------------------------------------------
  // 1. Sidebar Expandable Accordion & Sub-Menu Navigation
  // --------------------------------------------------------------------------
  test('Sidebar UI Styleguide expands into accordion with 13 indented sub-items and active indicator', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Verify UI Styleguide main nav item is present
    const styleguideNav = sidebar.getByRole('link', { name: 'UI Styleguide' });
    await expect(styleguideNav).toBeVisible();

    // Sub-items list (all 13 items specified in prompt)
    const expectedSubItems = [
      'Overview',
      'Design Tokens',
      'Live Indicators',
      'Bento Grid & Cards',
      'Buttons',
      'Badges & Pills',
      'Stat Cards',
      'Trust Ring',
      'Data Tables',
      'Drawers & Modals',
      'Charts',
      'Loading & Empty States',
      'Motion',
    ];

    for (const label of expectedSubItems) {
      await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    // Click "Buttons" sub-item
    await sidebar.getByRole('link', { name: 'Buttons', exact: true }).click();
    await page.waitForURL('**/styleguide/buttons');

    // Verify active child has highlighted styling
    const buttonsLink = sidebar.getByRole('link', { name: 'Buttons', exact: true });
    await expect(buttonsLink).toHaveClass(/text-brand/);

    // Group remains expanded on sub-item route
    await expect(sidebar.getByRole('link', { name: 'Design Tokens', exact: true })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'styleguide_sidebar_accordion_expanded.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 2. Collapsed Sidebar Flyout Menu with Clickable Links
  // --------------------------------------------------------------------------
  test('Collapsed sidebar (72px) reveals interactive flyout menu with sub-routes on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');

    const sidebar = page.locator('aside');

    // Click collapse toggle button on edge
    const collapseToggle = page.locator('button[aria-label="Collapse sidebar"]');
    await collapseToggle.click();
    await page.waitForTimeout(400);

    // Verify sidebar collapsed width
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.round(box.width)).toBe(72);
    }

    // Hover over the Styleguide icon
    const styleguideIcon = sidebar.locator('a[title="UI Styleguide"]');
    await expect(styleguideIcon).toBeVisible();
    await styleguideIcon.hover();
    await page.waitForTimeout(300);

    // Flyout should be visible with sub-items
    const flyout = page.locator('.group\\/navitem:has(a[title="UI Styleguide"]) .opacity-0');
    // In CSS group-hover, opacity transitions to 100
    const flyoutButtonsLink = sidebar.getByRole('link', { name: 'Data Tables' });
    await expect(flyoutButtonsLink).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'styleguide_sidebar_flyout_72px.png'),
    });

    // Click "Data Tables" in flyout
    await flyoutButtonsLink.click();
    await page.waitForURL('**/styleguide/tables');
    await expect(page.getByRole('heading', { name: 'Data Tables' })).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 3. /styleguide Overview: Clean Title, Search Filter, and Section Cards
  // --------------------------------------------------------------------------
  test('/styleguide overview renders single clean title, instant search filtering, and section cards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');
    await page.goto('/styleguide');
    await page.waitForLoadState('domcontentloaded');

    // Single clean page title (fixes duplicated title bug)
    const heading = page.getByRole('heading', { level: 1, name: 'ProctorIQ UI Component Styleguide' });
    await expect(heading).toBeVisible();

    // Verify that the duplicate title text does NOT appear
    await expect(page.getByText('ProctorIQ UI Component Styleguide — Mission Control Component Styleguide')).toHaveCount(0);

    // Verify search box filtering
    const searchInput = page.getByPlaceholder('Search components, tokens, charts...');
    await expect(searchInput).toBeVisible();

    // Search for "Charts"
    await searchInput.fill('Charts');
    await page.waitForTimeout(200);

    // Should show Charts card and filter out others
    await expect(page.getByRole('heading', { level: 3, name: 'Charts' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Buttons' })).toHaveCount(0);

    // Clear search
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(200);

    // All section cards reappear
    await expect(page.getByRole('heading', { level: 3, name: 'Buttons' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Design Tokens' })).toBeVisible();

    // Click "Charts" card in main overview to navigate
    await page.locator('main a[href="/styleguide/charts"]').click();
    await page.waitForURL('**/styleguide/charts');
    await expect(page.getByRole('heading', { level: 1, name: 'Charts' })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'styleguide_overview_1440px.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 4. Section Pages: Preview / Code Tabs, Variant Labels, and On-This-Page TOC
  // --------------------------------------------------------------------------
  test('Section pages render Preview/Code tabs, variant labels, and interactive On-This-Page TOC', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');
    await page.goto('/styleguide/buttons');
    await page.waitForLoadState('domcontentloaded');

    // Breadcrumb
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText('Styleguide')).toBeVisible();
    await expect(breadcrumb.getByText('Buttons')).toBeVisible();

    // Right-side "On this page" TOC
    const toc = page.locator('aside:has-text("On this page")');
    await expect(toc).toBeVisible();
    await expect(toc.getByText('Button Variants')).toBeVisible();
    await expect(toc.getByText('Sizes & Icons')).toBeVisible();
    await expect(toc.getByText('Interactive Loading State')).toBeVisible();

    // Demos preview cards
    const previewCards = page.locator('#variants, #sizes, #interactive-state');
    expect(await previewCards.count()).toBe(3);

    // Test Preview / Code tab switching
    const firstCard = page.locator('#variants');
    const codeTab = firstCard.getByRole('button', { name: 'Code' });
    await codeTab.click();

    // Code container should now be visible with formatted snippet and copy button
    await expect(firstCard.locator('pre code')).toBeVisible();
    await expect(firstCard.getByRole('button', { name: /Copy/i })).toBeVisible();

    // Switch back to Preview tab
    const previewTab = firstCard.getByRole('button', { name: 'Preview' });
    await previewTab.click();
    await expect(firstCard.getByRole('button', { name: 'Brand Primary' })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'styleguide_buttons_preview_code.png'),
    });
  });

  // --------------------------------------------------------------------------
  // 5. Pagination (Previous / Next) & Browser History Navigation
  // --------------------------------------------------------------------------
  test('Walks through sections using Next/Previous links and browser Back/Forward without blank screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin@proctoriq.io');
    await page.goto('/styleguide/tokens');
    await page.waitForLoadState('domcontentloaded');

    // At tokens, Next pagination button should point to Live Indicators
    const nextIndicators = page.locator('main').getByRole('link', { name: /Next Live Indicators/i });
    await expect(nextIndicators).toBeVisible();
    await nextIndicators.click();

    // Lands on /styleguide/indicators
    await page.waitForURL('**/styleguide/indicators');
    await expect(page.getByRole('heading', { level: 1, name: 'Live Indicators' })).toBeVisible();

    // Click Next to Bento Grid & Cards
    const nextBento = page.locator('main').getByRole('link', { name: /Next Bento Grid & Cards/i });
    await expect(nextBento).toBeVisible();
    await nextBento.click();

    await page.waitForURL('**/styleguide/bento');
    await expect(page.getByRole('heading', { level: 1, name: 'Bento Grid & Cards' })).toBeVisible();

    // Click Browser Back
    await page.goBack();
    await page.waitForURL('**/styleguide/indicators');
    await expect(page.getByRole('heading', { level: 1, name: 'Live Indicators' })).toBeVisible();

    // Click Browser Forward
    await page.goForward();
    await page.waitForURL('**/styleguide/bento');
    await expect(page.getByRole('heading', { level: 1, name: 'Bento Grid & Cards' })).toBeVisible();
  });
});
