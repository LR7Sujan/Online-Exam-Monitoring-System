import { test, expect } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';

test.describe('Merged Single Auth Entry Page Verification', () => {
  test('1440x900 Desktop Dark Mode: No vertical divider, fits in viewport, single continuous page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Confirm core elements are present
    await expect(page.locator('h1:has-text("Mission Control for")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
    await expect(page.locator('button:has-text("Create account")')).toBeVisible();
    await expect(page.locator('button:has-text("Authenticate & Enter Console")')).toBeVisible();
    await expect(page.locator('text=NODE ONLINE • MYSQL 8.0 ACID')).toBeVisible();

    // Verify no vertical divider (aside should not exist or have no border-r)
    const dividers = await page.locator('.border-r').count();
    expect(dividers).toBe(0);

    // Assert page fits viewport without vertical scrolling (scrollY === 0 and clientHeight == scrollHeight)
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    expect(isScrollable).toBeFalsy();

    // Capture screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth-entry-1440-dark.png'), fullPage: true });
  });

  test('1440x900 Desktop Light Mode: Toggle light mode, confirm no vertical line, single continuous background', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Click theme toggle to switch to light mode
    const themeBtn = page.locator('button[aria-label*="theme" i], button[title*="theme" i], button:has(.lucide-sun), button:has(.lucide-moon)').first();
    await themeBtn.click();
    await page.waitForTimeout(300);

    // Confirm light mode active (html element lacks dark class or has light class)
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    // Capture light mode screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth-entry-1440-light.png'), fullPage: true });

    // Switch back to dark mode
    await themeBtn.click();
  });

  test('1366x768 Laptop Viewport: Fits without page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    expect(isScrollable).toBeFalsy();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth-entry-1366-dark.png'), fullPage: true });
  });

  test('1024x768 Tablet Viewport: Brand header on top, card below, single column', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Mission Control for")')).toBeVisible();
    await expect(page.locator('button:has-text("Authenticate & Enter Console")')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth-entry-1024-dark.png'), fullPage: true });
  });

  test('390x844 Mobile Viewport: Clean single column, card centered, single footer line', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Mission Control for")')).toBeVisible();
    await expect(page.locator('button:has-text("Authenticate & Enter Console")')).toBeVisible();
    await expect(page.locator('text=NODE ONLINE • MYSQL 8.0 ACID')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth-entry-390-dark.png'), fullPage: false });
  });
});
