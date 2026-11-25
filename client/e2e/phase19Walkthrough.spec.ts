import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];

const THEMES: ('dark' | 'light')[] = ['dark', 'light'];

const OUTPUT_DIR = path.resolve(__dirname, '../../docs/phase19-screenshots');
const ARTIFACTS_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((t) => {
    localStorage.setItem('proctoriq-theme', t);
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  }, theme);
  await page.waitForTimeout(300);
}

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore non-application benign browser warnings & TFLite/MediaPipe telemetry
      if (
        !text.includes('favicon') &&
        !text.includes('Download the React DevTools') &&
        !text.includes('TensorFlow Lite') &&
        !text.includes('XNNPACK') &&
        !text.includes('odml.pa.googleapis.com')
      ) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}

async function takeWalkthroughScreenshot(page: Page, baseName: string, vpName: string, theme: string) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filename = `${baseName}-${vpName}-${theme}.png`;
  const targetPath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ path: targetPath, fullPage: false });

  // Also copy to artifacts directory for quick inspection
  try {
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.copyFileSync(targetPath, path.join(ARTIFACTS_DIR, filename));
    }
  } catch {
    // Artifact copy is optional best-effort
  }
}

test.describe('Phase 19 Multi-Viewport Walkthrough & Acceptance', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await page.route('**odml.pa.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('Screen 1: Entry Page (/login) across viewports and themes with 0 console errors', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);

    await page.goto('/login');
    await expect(page.locator('text=Zero-Trust').first()).toBeVisible({ timeout: 10000 });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        await takeWalkthroughScreenshot(page, '1-entry', vp.name, theme);
      }
    }

    expect(consoleErrors).toEqual([]);
  });

  test('Screen 2 & 3: Student Warning Screen with Snapshot and Result Page with Camera Off', async ({
    page,
    request,
  }) => {
    const consoleErrors = captureConsoleErrors(page);

    const studentEmail = `walkthrough.student.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Walkthrough Student',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    const regJson = await regRes.json();
    const token = regJson.data?.token;

    // Login student
    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });

    // Launch Pre-exam checklist
    await page.goto('/student');
    const launchKioskBtn = page.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
    await launchKioskBtn.click();
    await expect(page.locator('text=Pre-Flight Verification Kiosk')).toBeVisible({ timeout: 10000 });

    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');

    const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
    if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await authCamBtn.click();
      await expect(page.locator('text=OPTICAL & AUDIO SENSORS ACTIVE')).toBeVisible({ timeout: 8000 });
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(400);

    const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
    if (await enterFsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enterFsBtn.click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(400);

    const initBtn = page.locator('button:has-text("Initialize Assessment Session")');
    await expect(initBtn).toBeVisible({ timeout: 10000 });
    await initBtn.click();

    await page.waitForURL('**/student/session/**', { timeout: 20000 });
    const match = page.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;
    expect(sessionId).toBeGreaterThan(0);

    // Wait for video element
    const video = page.locator('video').first();
    await expect(video).toBeAttached({ timeout: 10000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2 && v.videoWidth > 0;
    }, { timeout: 15000 });

    // Generate evidence snapshot with bounding box & forensic strip
    const snapshotUri = await page.evaluate(async () => {
      const v = document.querySelector('video') as HTMLVideoElement;
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(v, 0, 0, 640, 480);

      // Phone Box
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 3;
      ctx.strokeRect(120, 80, 160, 240);
      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(120, 60, 130, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('PHONE: 94%', 125, 74);

      // Strip
      ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
      ctx.fillRect(0, 458, 640, 22);
      ctx.fillStyle = '#F43F5E';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('[PHONE_DETECTED]', 8, 473);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '10px monospace';
      ctx.fillText('2026-11-22 22:45:00 UTC • ProctorIQ Forensic Frame', 125, 473);

      return c.toDataURL('image/jpeg', 0.7);
    });

    // Send violation with snapshot
    const vioRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        code: 'PHONE_DETECTED',
        snapshot: snapshotUri,
        evidenceMeta: { confidence: 0.94 },
      },
    });
    expect(vioRes.ok()).toBeTruthy();

    // Verify warning overlay & evidence snapshot
    const warningOverlay = page.locator('[data-testid="violation-warning-overlay"]');
    await expect(warningOverlay).toBeVisible({ timeout: 10000 });

    const evidenceImg = page.locator('[data-testid="evidence-image-container"] img');
    await expect(evidenceImg).toBeVisible({ timeout: 10000 });

    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="evidence-image-container"] img') as HTMLImageElement;
      return img && img.complete && img.naturalWidth > 0;
    }, { timeout: 10000 });

    // SCREEN 2: Student Warning Screen across viewports & themes
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        await takeWalkthroughScreenshot(page, '2-warning-snapshot', vp.name, theme);
      }
    }

    // Acknowledge warning
    await page.waitForTimeout(2100);
    const ackBtn = page.locator('button:has-text("OK, I understand")');
    if (await ackBtn.isVisible().catch(() => false)) {
      await expect(ackBtn).toBeEnabled({ timeout: 6000 });
      await ackBtn.click();
      await expect(warningOverlay).not.toBeVisible({ timeout: 5000 });
    }

    // Submit exam
    await page.waitForTimeout(1000);
    const submitBtn = page.locator('[data-testid="hud-submit-exam-button"]');
    await submitBtn.click({ force: true });

    const confirmModalBtn = page.locator('[data-testid="confirm-submit-modal-btn"]');
    await expect(confirmModalBtn).toBeVisible({ timeout: 5000 });
    await confirmModalBtn.click();

    // SCREEN 3: Result Page with Camera Off indicator
    await page.waitForURL('**/student/results/**', { timeout: 20000 });
    const cameraOffBadge = page.locator('[data-testid="camera-off-indicator"]');
    await expect(cameraOffBadge).toBeVisible({ timeout: 10000 });
    await expect(cameraOffBadge).toContainText('Exam ended, camera off');

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        await takeWalkthroughScreenshot(page, '3-result-camera-off', vp.name, theme);
      }
    }

    expect(consoleErrors).toEqual([]);
  });

  test('Screen 4: Simulator Realistic Run Summary across viewports and themes with 0 console errors', async ({
    page,
  }) => {
    const consoleErrors = captureConsoleErrors(page);

    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/admin|\/home/, { timeout: 15000 });

    await page.goto('/admin/simulator');
    await expect(page.locator('text=Simulation Controls').first()).toBeVisible({ timeout: 10000 });

    // Launch swarm to show active persona cards if not already active
    const launchSwarmBtn = page.locator('button:has-text("LAUNCH SWARM")');
    if (await launchSwarmBtn.isVisible().catch(() => false)) {
      await launchSwarmBtn.click();
      await page.waitForTimeout(3000);
    }

    // Verify candidate tiles in simulator
    await expect(page.locator('text=Virtual Candidate').first()).toBeVisible({ timeout: 15000 });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        await takeWalkthroughScreenshot(page, '4-simulator-summary', vp.name, theme);
      }
    }

    expect(consoleErrors).toEqual([]);
  });

  test('Screen 5: Live Monitor Student Tiles across viewports and themes with 0 console errors', async ({
    page,
  }) => {
    const consoleErrors = captureConsoleErrors(page);

    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });

    await page.goto('/proctor');
    await expect(page.locator('text=Proctor Mission Control').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        await takeWalkthroughScreenshot(page, '5-live-monitor-tiles', vp.name, theme);
      }
    }

    expect(consoleErrors).toEqual([]);
  });

  test('Screen 6: Loading & Empty States Page across viewports and themes with 0 console errors', async ({
    page,
  }) => {
    const consoleErrors = captureConsoleErrors(page);

    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/admin|\/home/, { timeout: 15000 });

    await page.goto('/styleguide/loading-empty-states');
    await expect(page.locator('text=Loading & Empty States').first()).toBeVisible({ timeout: 10000 });

    // Wait for auto-resolution to loaded state with rows visible
    await expect(page.locator('[data-testid="interactive-row"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Elena Kaur').first()).toBeVisible({ timeout: 10000 });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        await takeWalkthroughScreenshot(page, '6-loading-empty-states', vp.name, theme);
      }
    }

    expect(consoleErrors).toEqual([]);
  });
});
