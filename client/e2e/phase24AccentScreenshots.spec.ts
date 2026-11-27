import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const artifactDir = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';

test.describe('Phase 24 Accent System & Multi-Role Theme Screenshots', () => {
  test.setTimeout(180000);

  test.beforeAll(() => {
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
  });

  async function setAppearance(page: any, theme: 'dark' | 'light', accent: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose') {
    await page.evaluate(({ t, a }: { t: string; a: string }) => {
      localStorage.setItem('proctoriq-theme', t);
      localStorage.setItem('proctoriq-accent', a);
      const root = document.documentElement;
      root.setAttribute('data-accent', a);
      if (t === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }, { t: theme, a: accent });
    await page.waitForTimeout(300);
  }

  async function login(page: any, email: string, role: string) {
    await page.goto('/?tab=signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?tab=signin');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');

    await Promise.all([
      page.waitForResponse(
        (res: any) => res.url().includes('/api/auth/login') && res.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button:has-text("Authenticate & Enter Console")'),
    ]);

    await page.waitForTimeout(500);
  }

  test('Student Role - Dark & Cream Light with multiple accents', async ({ page }) => {
    await login(page, 'student1@proctoriq.io', 'STUDENT');
    await page.goto('/student');
    await page.waitForLoadState('networkidle');

    // 1. Student Dark (Indigo)
    await setAppearance(page, 'dark', 'indigo');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-student-dark-indigo.png'), fullPage: false });

    // 2. Student Cream Light (Amber)
    await setAppearance(page, 'light', 'amber');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-student-light-amber.png'), fullPage: false });

    // 3. Student Dark (Emerald)
    await setAppearance(page, 'dark', 'emerald');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-student-dark-emerald.png'), fullPage: false });
  });

  test('Proctor Role - Dark & Cream Light with multiple accents', async ({ page }) => {
    await login(page, 'proctor1@proctoriq.io', 'PROCTOR');
    await page.goto('/proctor');
    await page.waitForLoadState('networkidle');

    // 1. Proctor Dark (Cyan)
    await setAppearance(page, 'dark', 'cyan');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-proctor-dark-cyan.png'), fullPage: false });

    // 2. Proctor Cream Light (Indigo)
    await setAppearance(page, 'light', 'indigo');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-proctor-light-indigo.png'), fullPage: false });
  });

  test('Admin Role - Dark & Cream Light with multiple accents', async ({ page }) => {
    await login(page, 'admin@proctoriq.io', 'ADMIN');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // 1. Admin Dark (Rose)
    await setAppearance(page, 'dark', 'rose');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-admin-dark-rose.png'), fullPage: false });

    // 2. Admin Cream Light (Emerald)
    await setAppearance(page, 'light', 'emerald');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-admin-light-emerald.png'), fullPage: false });
  });

  test('Styleguide Tokens Section - Interactive accent switcher', async ({ page }) => {
    await login(page, 'admin@proctoriq.io', 'ADMIN');
    await page.goto('/styleguide');
    await page.waitForLoadState('networkidle');

    // Styleguide Dark with Emerald accent
    await setAppearance(page, 'dark', 'emerald');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-styleguide-dark-emerald.png'), fullPage: false });

    // Styleguide Cream Light with Amber accent
    await setAppearance(page, 'light', 'amber');
    await page.screenshot({ path: path.join(artifactDir, 'phase24-styleguide-light-amber.png'), fullPage: false });
  });
});
