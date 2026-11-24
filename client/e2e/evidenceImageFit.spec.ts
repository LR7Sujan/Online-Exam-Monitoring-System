import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/phase20-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Generate real valid base64 JPEG test images with exact dimensions using HTML5 Canvas in browser
async function generateCanvasJpeg(page: Page, width: number, height: number, label: string): Promise<string> {
  return await page.evaluate(
    ({ w, h, lbl }) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Background
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // Inner border
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);

      // Label
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`${lbl} (${w}x${h})`, 24, Math.min(Math.max(h / 2, 35), h - 35));

      // Forensic bottom strip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, h - 24, w, 24);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`ProctorIQ Forensic Strip • ${w}x${h}`, 12, h - 8);

      return canvas.toDataURL('image/jpeg', 0.8);
    },
    { w: width, h: height, lbl: label }
  );
}

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((t) => {
    const html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, theme);
  await page.waitForTimeout(200);
}

test.describe('Phase 20: EvidenceImage Geometric Fit & Layout Invariants', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Google telemetry to avoid external 403s
    await page.route('**odml.pa.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('1. Warning Screen: Image is fully inside its wrapper and wrapper is inside card for landscape, portrait, and very wide images', async ({
    page,
    request,
  }) => {
    // Register candidate in test environment
    const studentEmail = `evidence.fit.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Evidence Fit Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const regJson = await regRes.json();
    const token = regJson.data?.token;

    // Login student
    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student');

    // Launch first available live assessment
    const startBtn = page.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await expect(page.locator('text=Pre-Flight Verification Kiosk')).toBeVisible({ timeout: 10000 });
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');

    const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
    if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await authCamBtn.click();
      await expect(page.locator('text=OPTICAL & AUDIO SENSORS ACTIVE')).toBeVisible({ timeout: 8000 });
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);

    const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
    if (await enterFsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enterFsBtn.click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);

    const initBtn = page.locator('button:has-text("Initialize Assessment Session")');
    await expect(initBtn).toBeVisible({ timeout: 10000 });
    await initBtn.click();

    await page.waitForURL('**/student/session/**', { timeout: 20000 });
    const match = page.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;
    expect(sessionId).toBeGreaterThan(0);

    // Generate valid JPEG data URLs for each format
    const testFormats = [
      { name: 'landscape', w: 640, h: 480 },
      { name: 'portrait', w: 480, h: 640 },
      { name: 'veryWide', w: 800, h: 250 },
    ];

    for (const fmt of testFormats) {
      console.log(`Testing format: ${fmt.name} (${fmt.w}x${fmt.h})`);
      const dataUri = await generateCanvasJpeg(page, fmt.w, fmt.h, fmt.name.toUpperCase());

      // Fire a valid violation (NO_FACE: 10 pts) with this format snapshot
      const vioRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          code: 'NO_FACE',
          snapshot: dataUri,
        },
      });
      const vioJson = await vioRes.json();
      expect(vioJson.success).toBe(true);

      const warningOverlay = page.locator('[data-testid="violation-warning-overlay"]');
      await expect(warningOverlay).toBeVisible({ timeout: 10000 });

      const card = warningOverlay.locator('.rounded-3xl').first();
      await expect(card).toBeVisible();

      const wrapper = warningOverlay.locator('[data-testid="evidence-image-container"]').first();
      await expect(wrapper).toBeVisible({ timeout: 8000 });

      const img = wrapper.locator('img');
      await expect(img).toBeVisible({ timeout: 8000 });
      await expect.poll(async () => {
        return await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
      }, { timeout: 5000 }).toBe(true);
      await page.waitForTimeout(150);

      // Geometric verification
      const imgBox = await img.boundingBox();
      const wrapperBox = await wrapper.boundingBox();
      const cardBox = await card.boundingBox();

      expect(imgBox).not.toBeNull();
      expect(wrapperBox).not.toBeNull();
      expect(cardBox).not.toBeNull();

      if (imgBox && wrapperBox && cardBox) {
        // 1. Assert image is fully inside wrapper boundaries (with 3px sub-pixel/border tolerance)
        expect(imgBox.x).toBeGreaterThanOrEqual(wrapperBox.x - 3);
        expect(imgBox.y).toBeGreaterThanOrEqual(wrapperBox.y - 3);
        expect(imgBox.x + imgBox.width).toBeLessThanOrEqual(wrapperBox.x + wrapperBox.width + 3);
        expect(imgBox.y + imgBox.height).toBeLessThanOrEqual(wrapperBox.y + wrapperBox.height + 3);

        // 2. Assert wrapper is fully inside card boundaries
        expect(wrapperBox.x).toBeGreaterThanOrEqual(cardBox.x - 3);
        expect(wrapperBox.x + wrapperBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 3);

        // 3. Assert wrapper max-height does not exceed 221px (per spec #4)
        expect(wrapperBox.height).toBeLessThanOrEqual(221);

        console.log(
          `[PASS ${fmt.name}] Card: ${cardBox.width.toFixed(0)}x${cardBox.height.toFixed(0)} | Wrapper: ${wrapperBox.width.toFixed(0)}x${wrapperBox.height.toFixed(0)} | Img: ${imgBox.width.toFixed(0)}x${imgBox.height.toFixed(0)}`
        );
      }

      // Check Lightbox on click
      await wrapper.click();
      const lightbox = page.locator('[data-testid="evidence-image-lightbox"]');
      await expect(lightbox).toBeVisible({ timeout: 5000 });

      const lightboxImg = lightbox.locator('img');
      await expect(lightboxImg).toBeVisible();
      const lightboxImgBox = await lightboxImg.boundingBox();
      expect(lightboxImgBox).not.toBeNull();
      expect(lightboxImgBox!.width).toBeGreaterThan(0);
      expect(lightboxImgBox!.height).toBeGreaterThan(0);

      // Close Lightbox with Escape
      await page.keyboard.press('Escape');
      await expect(lightbox).not.toBeVisible({ timeout: 5000 });
      await page.mouse.move(0, 0);

      // Take screenshot of warning screen with this format
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `warning-${fmt.name}.png`),
      });

      // Acknowledge warning to clear for next format test
      await page.waitForTimeout(2100);
      const ackBtn = warningOverlay.locator('button:has-text("OK, I understand")');
      await expect(ackBtn).toBeEnabled({ timeout: 5000 });
      await ackBtn.click();
      await expect(warningOverlay).not.toBeVisible({ timeout: 5000 });

      // Wait out grace period
      await page.waitForTimeout(5200);
    }
  });

  test('2. Viewport 1366x768 and 1440x900: Warning screen fits without page scroll', async ({
    page,
    request,
  }) => {
    const studentEmail = `viewport.fit.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Viewport Fit Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    const regJson = await regRes.json();
    const token = regJson.data?.token;

    await page.goto('/login');
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student');

    // Launch first available live assessment
    const startBtn = page.locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")').first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await expect(page.locator('text=Pre-Flight Verification Kiosk')).toBeVisible({ timeout: 10000 });
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');

    const authCamBtn = page.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
    if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await authCamBtn.click();
      await expect(page.locator('text=OPTICAL & AUDIO SENSORS ACTIVE')).toBeVisible({ timeout: 8000 });
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);

    const enterFsBtn = page.locator('button:has-text("Enter Lockdown Fullscreen")');
    if (await enterFsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enterFsBtn.click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);

    const initBtn = page.locator('button:has-text("Initialize Assessment Session")');
    await initBtn.click();
    await page.waitForURL('**/student/session/**', { timeout: 20000 });
    const match = page.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;

    const landscapeJpeg = await generateCanvasJpeg(page, 640, 480, 'LANDSCAPE');

    // Trigger violation (NO_FACE: 10 pts)
    const vioRes = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        code: 'NO_FACE',
        snapshot: landscapeJpeg,
      },
    });
    const vioJson = await vioRes.json();
    expect(vioJson.success).toBe(true);

    const warningOverlay = page.locator('[data-testid="violation-warning-overlay"]');
    await expect(warningOverlay).toBeVisible({ timeout: 10000 });
    const card = warningOverlay.locator('.rounded-3xl').first();
    await expect(card).toBeVisible();

    // Test at 1366x768
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);
    const cardBox1366 = await card.boundingBox();
    expect(cardBox1366).not.toBeNull();
    // Card must fit inside 768px height
    expect(cardBox1366!.height).toBeLessThanOrEqual(768);
    // Page window scroll position must be 0
    const scrollY1366 = await page.evaluate(() => window.scrollY);
    expect(scrollY1366).toBe(0);

    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'warning-1366x768-dark.png') });
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'warning-1366x768-light.png') });

    // Test at 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    const cardBox1440 = await card.boundingBox();
    expect(cardBox1440).not.toBeNull();
    expect(cardBox1440!.height).toBeLessThanOrEqual(900);
    const scrollY1440 = await page.evaluate(() => window.scrollY);
    expect(scrollY1440).toBe(0);

    // Test at 1024x768
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'warning-1024x768-dark.png') });

    // Test at 390x844 (Mobile)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'warning-390x844-dark.png') });
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'warning-390x844-light.png') });
  });

  test('3. Proctor Drawer & Audit Table: EvidenceImage is contained with no overflow', async ({
    page,
  }) => {
    // Login as Proctor
    await page.goto('/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await page.goto('/proctor');

    // Click first student tile to open detail drawer
    const firstTile = page.locator('[data-testid^="student-tile-"]').first();
    await expect(firstTile).toBeVisible({ timeout: 10000 });
    await firstTile.click();

    const drawer = page.locator('[data-testid="student-detail-drawer"]');
    await expect(drawer).toBeVisible({ timeout: 8000 });

    // Assert any thumbnails in drawer stay within their container
    const drawerThumbs = drawer.locator('[data-testid="evidence-image-container"]');
    const thumbCount = await drawerThumbs.count();
    if (thumbCount > 0) {
      const firstThumb = drawerThumbs.first();
      await expect(firstThumb).toBeVisible({ timeout: 5000 });
      const thumbBox = await firstThumb.boundingBox();
      const thumbImg = firstThumb.locator('img');
      if (await thumbImg.isVisible({ timeout: 3000 }).catch(() => false)) {
        const thumbImgBox = await thumbImg.boundingBox();
        if (thumbBox && thumbImgBox) {
          expect(thumbImgBox.x).toBeGreaterThanOrEqual(thumbBox.x - 2);
          expect(thumbImgBox.y).toBeGreaterThanOrEqual(thumbBox.y - 2);
          expect(thumbImgBox.x + thumbImgBox.width).toBeLessThanOrEqual(thumbBox.x + thumbBox.width + 2);
          expect(thumbImgBox.y + thumbImgBox.height).toBeLessThanOrEqual(thumbBox.y + thumbBox.height + 2);
        }
      }
    }

    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'proctor-drawer-evidence-dark.png') });
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'proctor-drawer-evidence-light.png') });

    // Close drawer
    const closeDrawerBtn = drawer.locator('button[aria-label="Close drawer"], button:has-text("Close")').first();
    if (await closeDrawerBtn.isVisible().catch(() => false)) {
      await closeDrawerBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);

    // Switch to Adjudication Queue / Violation Audit tab on proctor console
    const auditTabBtn = page.locator('button:has-text("Adjudication Queue"), button:has-text("Violation Audit")').first();
    await expect(auditTabBtn).toBeVisible({ timeout: 10000 });
    await auditTabBtn.click();

    const auditTable = page.locator('[data-source="vw_ViolationAuditReport"]');
    await expect(auditTable).toBeVisible({ timeout: 10000 });

    const auditThumbs = auditTable.locator('[data-testid="evidence-image-container"]');
    const auditThumbCount = await auditThumbs.count();
    if (auditThumbCount > 0) {
      const firstAuditThumb = auditThumbs.first();
      await expect(firstAuditThumb).toBeVisible({ timeout: 5000 });
      const auditBox = await firstAuditThumb.boundingBox();
      const auditImg = firstAuditThumb.locator('img');
      if (await auditImg.isVisible({ timeout: 3000 }).catch(() => false)) {
        const auditImgBox = await auditImg.boundingBox();
        if (auditBox && auditImgBox) {
          expect(auditImgBox.x).toBeGreaterThanOrEqual(auditBox.x - 2);
          expect(auditImgBox.y).toBeGreaterThanOrEqual(auditBox.y - 2);
          expect(auditImgBox.x + auditImgBox.width).toBeLessThanOrEqual(auditBox.x + auditBox.width + 2);
          expect(auditImgBox.y + auditImgBox.height).toBeLessThanOrEqual(auditBox.y + auditBox.height + 2);
        }
      }
    }

    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit-table-evidence-dark.png') });
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit-table-evidence-light.png') });
  });
});
