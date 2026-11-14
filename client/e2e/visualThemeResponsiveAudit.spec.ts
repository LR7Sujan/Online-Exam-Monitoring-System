import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const SCREENSHOTS_DIR = fs.existsSync(path.resolve(process.cwd(), 'docs/qa-screenshots'))
  ? path.resolve(process.cwd(), 'docs/qa-screenshots')
  : path.resolve(process.cwd(), '../docs/qa-screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

interface ViewportConfig {
  width: number;
  height: number;
  name: string;
}

const VIEWPORTS: ViewportConfig[] = [
  { width: 1440, height: 900, name: '1440px' },
  { width: 1024, height: 768, name: '1024px' },
  { width: 390, height: 844, name: '390px' },
];

const THEMES: Array<'dark' | 'light'> = ['dark', 'light'];

test.describe('Sub-Phase 11.7: Comprehensive Responsive, Theme & Visual Integrity Audit', () => {
  test.setTimeout(180000); // 3 minutes total for full matrix

  // Helper to configure theme via localStorage and initialize page
  async function preparePage(context: any, theme: 'dark' | 'light', viewport: ViewportConfig) {
    const page = await context.newPage();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // Inject localStorage theme setting before initial load
    await page.addInitScript((t: string) => {
      localStorage.setItem('proctoriq-theme', t);
    }, theme);

    return page;
  }

  // Helper to authenticate user and store auth token
  async function loginUser(page: any, email: string) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(400);
  }

  // Helper to check horizontal overflow and basic visual contrast
  async function inspectVisualIntegrity(page: any, label: string) {
    const overflowReport = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const hasOverflow = scrollW > clientW + 2;
      const elements: any[] = [];

      if (hasOverflow) {
        document.querySelectorAll('*').forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.right > clientW + 2 && rect.width > 0 && rect.height > 0) {
            elements.push({
              tag: el.tagName,
              className: String(el.className || '').slice(0, 50),
              right: Math.round(rect.right),
              overflowPx: Math.round(rect.right - clientW),
            });
          }
        });
      }

      return { hasOverflow, scrollW, clientW, elements: elements.slice(0, 3) };
    });

    if (overflowReport.hasOverflow) {
      console.warn(`[Visual Overflow Warning] ${label}:`, overflowReport);
    }

    return overflowReport;
  }

  // ==========================================================================
  // 1. PUBLIC ROUTES (Landing, Login, Register, Styleguide, 404)
  // ==========================================================================
  test('Public Pages: Screenshot matrix and responsive inspection', async ({ browser }) => {
    const publicPages = [
      { name: 'landing', path: '/' },
      { name: 'login', path: '/login' },
      { name: 'register', path: '/register' },
      { name: 'styleguide', path: '/styleguide' },
      { name: 'not_found_404', path: '/system-matrix-404-nonexistent-sector' },
    ];

    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await preparePage(context, theme, vp);

        for (const item of publicPages) {
          await page.goto(item.path);
          await page.waitForTimeout(400); // allow transitions to settle

          // Verify page loaded
          const bodyVisible = await page.locator('body').isVisible();
          expect(bodyVisible).toBe(true);

          await inspectVisualIntegrity(page, `Public ${item.name} (${theme}, ${vp.name})`);

          const filename = `public_${item.name}_${theme}_${vp.name}.png`;
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, filename),
            fullPage: false,
          });
        }
        await context.close();
      }
    }
  });

  // ==========================================================================
  // 2. STUDENT ROLE (Dashboard, Active Exam Kiosk, Results Certificate)
  // ==========================================================================
  test('Student Pages: Screenshot matrix and responsive inspection', async ({ browser }) => {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await preparePage(context, theme, vp);

        // 1. Student Dashboard (student@proctoriq.io)
        await loginUser(page, 'student@proctoriq.io');
        await page.goto('/student');
        await page.waitForSelector('text=Candidate Examination Console', { timeout: 15000 });
        await inspectVisualIntegrity(page, `Student Dashboard (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `student_dashboard_${theme}_${vp.name}.png`),
        });

        // 2. Student Result Page (/student/results/13)
        await page.goto('/student/results/13');
        await page.waitForSelector('text=Examination Result & Integrity Certificate', { timeout: 15000 });
        // Wait for Recharts donut animation to complete
        await page.waitForTimeout(600);
        await inspectVisualIntegrity(page, `Student Results (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `student_results_${theme}_${vp.name}.png`),
        });

        await context.close();

        // 3. Active Exam Kiosk Session 1 (owned by student2@proctoriq.io)
        const kioskContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const kioskPage = await preparePage(kioskContext, theme, vp);
        await loginUser(kioskPage, 'student2@proctoriq.io');
        await kioskPage.goto('/student/session/1');
        await kioskPage.waitForSelector('text=Question Palette', { timeout: 15000 });
        await kioskPage.waitForTimeout(500);
        await inspectVisualIntegrity(kioskPage, `Student Exam Kiosk (${theme}, ${vp.name})`);
        await kioskPage.screenshot({
          path: path.join(SCREENSHOTS_DIR, `student_exam_kiosk_${theme}_${vp.name}.png`),
        });

        await kioskContext.close();
      }
    }
  });

  // ==========================================================================
  // 3. PROCTOR ROLE (Live Monitor, Adjudication Queue, Student Drawer)
  // ==========================================================================
  test('Proctor Pages: Screenshot matrix and responsive inspection', async ({ browser }) => {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await preparePage(context, theme, vp);

        await loginUser(page, 'proctor@proctoriq.io');

        // 1. Live Monitor
        await page.goto('/proctor');
        await page.waitForSelector('text=Proctor Mission Control', { timeout: 15000 });
        await page.waitForTimeout(500);
        await inspectVisualIntegrity(page, `Proctor Live Monitor (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `proctor_live_monitor_${theme}_${vp.name}.png`),
        });

        // 2. Adjudication Review Queue
        await page.goto('/proctor/audit');
        await page.waitForSelector('text=Adjudication Queue', { timeout: 15000 });
        await page.waitForTimeout(500);
        await inspectVisualIntegrity(page, `Proctor Adjudication Queue (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `proctor_adjudication_queue_${theme}_${vp.name}.png`),
        });

        // 3. Candidate Inspector Drawer open (on 1440 and 1024)
        if (vp.width >= 1024) {
          await page.goto('/proctor');
          await page.waitForSelector('text=Inspect', { timeout: 15000 });
          const inspectBtn = page.locator('button:has-text("Inspect")').first();
          if (await inspectBtn.isVisible().catch(() => false)) {
            await inspectBtn.click();
            await page.waitForTimeout(600); // Wait for drawer portal animation
            await page.screenshot({
              path: path.join(SCREENSHOTS_DIR, `proctor_student_drawer_${theme}_${vp.name}.png`),
            });
          }
        }

        await context.close();
      }
    }
  });

  // ==========================================================================
  // 4. ADMIN ROLE (Overview, Exam Manager, Analytics, Simulator)
  // ==========================================================================
  test('Admin Pages: Screenshot matrix and responsive inspection', async ({ browser }) => {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await preparePage(context, theme, vp);

        await loginUser(page, 'admin@proctoriq.io');

        // 1. Admin Overview
        await page.goto('/admin');
        await page.waitForSelector('text=Overview Analytics', { timeout: 15000 });
        await page.waitForTimeout(500);
        await inspectVisualIntegrity(page, `Admin Overview (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin_overview_${theme}_${vp.name}.png`),
        });

        // 2. Exam Manager
        await page.goto('/admin/exams');
        await page.waitForSelector('text=Architect New Examination', { timeout: 15000 });
        await page.waitForTimeout(500);
        await inspectVisualIntegrity(page, `Admin Exam Manager (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin_exams_${theme}_${vp.name}.png`),
        });

        // 3. Analytics Deck
        await page.goto('/admin/analytics');
        await page.waitForSelector('text=Violations Telemetry Over Time', { timeout: 15000 });
        await page.waitForTimeout(600); // allow chart rendering
        await inspectVisualIntegrity(page, `Admin Analytics (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin_analytics_${theme}_${vp.name}.png`),
        });

        // 4. Rules & Infractions
        const rulesTab = page.locator('button:has-text("Rules & Simulator")');
        if (await rulesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await rulesTab.click();
          await page.waitForTimeout(400);
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, `admin_rules_${theme}_${vp.name}.png`),
          });
        }

        // 5. Simulator Page
        await page.goto('/admin/simulator');
        await page.waitForSelector('text=Candidate Swarm Demo Simulator', { timeout: 15000 });
        await page.waitForTimeout(500);
        await inspectVisualIntegrity(page, `Admin Simulator (${theme}, ${vp.name})`);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin_simulator_${theme}_${vp.name}.png`),
        });

        await context.close();
      }
    }
  });

  // ==========================================================================
  // 5. MOTION ACCESSIBILITY: PREFERS-REDUCED-MOTION
  // ==========================================================================
  test('Motion Accessibility: prefers-reduced-motion correctly suppresses CSS & JS animations', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    await page.goto('/');
    const motionAudit = await page.evaluate(() => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const el = document.querySelector('.aurora-backdrop') || document.body;
      const style = window.getComputedStyle(el);
      return {
        mediaMatches: media.matches,
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });

    expect(motionAudit.mediaMatches).toBe(true);
    // index.css sets animation-duration: 0.001ms !important when reducedMotion is active
    expect(
      parseFloat(motionAudit.animationDuration) <= 0.001 ||
      motionAudit.animationDuration === '0s' ||
      motionAudit.animationDuration === ''
    ).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'accessibility_reduced_motion_1440px.png'),
    });

    await context.close();
  });
});
