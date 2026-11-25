import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Phase 19: Forensic Evidence Snapshot Capture & Delivery', () => {
  test.setTimeout(90000);

  test('captures webcam frame, draws boxes & forensic strip, delivers to warning screen & proctor drawer', async ({
    browser,
    request,
  }) => {
    // 1. Setup Proctor Context
    const proctorContext = await browser.newContext();
    const proctorPage = await proctorContext.newPage();
    await proctorPage.goto('/login');
    await proctorPage.fill('input[type="email"]', 'proctor@proctoriq.io');
    await proctorPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await proctorPage.click('button:has-text("Authenticate & Enter Console")');
    await proctorPage.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await proctorPage.goto('/proctor');
    await expect(proctorPage.locator('text=Proctor Mission Control')).toBeVisible({ timeout: 10000 });

    // 2. Setup Student Context
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    studentPage.on('console', (msg) => {
      console.log(`[STUDENT BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    studentPage.on('pageerror', (err) => {
      console.error(`[STUDENT BROWSER ERROR]`, err);
    });
    studentPage.on('response', async (res) => {
      if (res.url().includes('uploads') || res.url().includes('violation')) {
        let body = '';
        try {
          body = await res.text();
        } catch { }
        console.log(`[STUDENT RES] ${res.status()} ${res.url()} -> BODY: ${body}`);
      }
    });

    const studentEmail = `snapshot.candidate.${Date.now()}@proctoriq.io`;
    const regRes = await request.post('http://localhost:4001/api/auth/register', {
      data: {
        fullName: 'Snapshot Candidate',
        email: studentEmail,
        password: 'ProctorIQ#2026',
      },
    });
    const regJson = await regRes.json();
    const studentToken = regJson.data?.token;

    // Login student
    await studentPage.goto('/login');
    await studentPage.fill('input[type="email"]', studentEmail);
    await studentPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await studentPage.click('button:has-text("Authenticate & Enter Console")');
    await studentPage.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await studentPage.goto('/student');

    // Launch Exam #5 (1-min exam) or Exam #1
    const examCard = studentPage.locator('[data-testid="exam-card-5"], [data-testid="exam-card-1"]').first();
    await expect(examCard).toBeVisible({ timeout: 10000 });
    await examCard
      .locator('button:has-text("Launch Pre-Exam Checklist"), button:has-text("Resume Active Session")')
      .first()
      .click();

    // Complete Pre-Exam Checklist
    await expect(studentPage.locator('text=Pre-Flight Verification Kiosk')).toBeVisible({ timeout: 10000 });
    await studentPage.check('input[type="checkbox"]');
    await studentPage.click('button:has-text("Continue")');

    const authCamBtn = studentPage.locator('button:has-text("Authorize Camera & Microphone"), button:has-text("Activate Webcam Sensor")');
    if (await authCamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await authCamBtn.click();
      await expect(studentPage.locator('text=OPTICAL & AUDIO SENSORS ACTIVE')).toBeVisible({ timeout: 8000 });
    }
    await studentPage.click('button:has-text("Continue")');
    await studentPage.waitForTimeout(400);

    const enterFsBtn = studentPage.locator('button:has-text("Enter Lockdown Fullscreen")');
    if (await enterFsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enterFsBtn.click();
      await studentPage.waitForTimeout(300);
    }
    await studentPage.click('button:has-text("Continue")');
    await studentPage.waitForTimeout(400);

    const launchBtn = studentPage.locator('button:has-text("Initialize Assessment Session")');
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    await studentPage.waitForURL('**/student/session/**', { timeout: 20000 });
    const match = studentPage.url().match(/\/student\/session\/(\d+)/);
    const sessionId = match ? Number(match[1]) : 0;
    expect(sessionId).toBeGreaterThan(0);

    // Wait for video element in student page to be active
    const video = studentPage.locator('video').first();
    await expect(video).toBeAttached({ timeout: 10000 });

    // Wait for video stream readyState >= 2
    await studentPage.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2 && v.videoWidth > 0;
    }, { timeout: 15000 });

    // 3. Capture real fake camera video frame with PHONE bounding box
    const phoneSnapshotDataUri = await studentPage.evaluate(async () => {
      const v = document.querySelector('video') as HTMLVideoElement;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      // Draw real video stream
      ctx.drawImage(v, 0, 0, 640, 480);

      // Draw PHONE bounding box
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 3;
      ctx.strokeRect(120, 80, 160, 240);

      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(120, 60, 130, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('PHONE: 94%', 125, 74);

      // Draw forensic bottom strip
      ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
      ctx.fillRect(0, 458, 640, 22);
      ctx.fillStyle = '#F43F5E';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('[PHONE_DETECTED]', 8, 473);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '10px monospace';
      ctx.fillText('2026-11-22 22:45:00 UTC • ProctorIQ Forensic Frame', 125, 473);

      return canvas.toDataURL('image/jpeg', 0.7);
    });

    expect(phoneSnapshotDataUri).toContain('data:image/jpeg;base64,');

    // 4. Trigger PHONE_DETECTED violation via API with captured snapshot
    const vioRes1 = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        code: 'PHONE_DETECTED',
        snapshot: phoneSnapshotDataUri,
        evidenceMeta: { confidence: 0.94 },
      },
    });
    const vioJson1 = await vioRes1.json();
    expect(vioJson1.success).toBe(true);
    expect(vioJson1.data.snapshot_url).toBeTruthy();

    // 5. Assert Warning Screen appears on student page and displays the snapshot
    const warningOverlay = studentPage.locator('[data-testid="violation-warning-overlay"]');
    await expect(warningOverlay).toBeVisible({ timeout: 10000 });
    await expect(warningOverlay.locator('text=A mobile phone was detected')).toBeVisible();

    const evidenceContainer = warningOverlay.locator('[data-testid="evidence-image-container"]');
    await expect(evidenceContainer).toBeVisible({ timeout: 10000 });

    const evidenceImg = evidenceContainer.locator('img');
    await expect(evidenceImg).toBeVisible({ timeout: 10000 });

    // Verify naturalWidth > 0 and sample canvas pixel variance (not a solid blank color)
    const phoneImgMetrics = await evidenceImg.evaluate((img: HTMLImageElement) => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return { naturalWidth: 0, naturalHeight: 0, variance: 0 };

      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d')!;
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, w, h).data;

      let sum = 0;
      const lumas: number[] = [];
      const step = Math.max(1, Math.floor(data.length / 2000));
      for (let i = 0; i < data.length; i += step * 4) {
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += l;
        lumas.push(l);
      }
      const mean = sum / lumas.length;
      let varSum = 0;
      for (const l of lumas) varSum += (l - mean) ** 2;
      const variance = varSum / lumas.length;

      return { naturalWidth: w, naturalHeight: h, variance };
    });

    console.log('PHONE_DETECTED Evidence Image Metrics:', JSON.stringify(phoneImgMetrics));
    expect(phoneImgMetrics.naturalWidth).toBeGreaterThan(0);
    expect(phoneImgMetrics.naturalHeight).toBeGreaterThan(0);
    expect(phoneImgMetrics.variance).toBeGreaterThan(10); // Non-solid image with real details

    // Take a screenshot of the warning screen with the evidence photo
    const docsDir = path.resolve(process.cwd(), '../docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    await studentPage.screenshot({
      path: path.join(docsDir, 'phase19-warning-phone-snapshot.png'),
    });

    // 6. Test Lightbox Zoom on the snapshot
    await evidenceContainer.locator('div.group').click();
    const lightbox = studentPage.locator('[data-testid="evidence-image-lightbox"]');
    await expect(lightbox).toBeVisible({ timeout: 5000 });
    await studentPage.keyboard.press('Escape');
    await expect(lightbox).not.toBeVisible();

    // 7. Acknowledge warning
    await studentPage.waitForTimeout(2100);
    const ackBtn = warningOverlay.locator('button:has-text("OK, I understand")');
    await expect(ackBtn).toBeEnabled({ timeout: 5000 });
    await ackBtn.click();
    await expect(warningOverlay).not.toBeVisible({ timeout: 5000 });

    // Wait for warning grace period (5 seconds)
    await studentPage.waitForTimeout(5500);

    // 8. Capture MULTIPLE_FACES frame with two face boxes
    const multiFaceSnapshotDataUri = await studentPage.evaluate(async () => {
      const v = document.querySelector('video') as HTMLVideoElement;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      // Draw real video stream
      ctx.drawImage(v, 0, 0, 640, 480);

      // Face 1 box
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.strokeRect(80, 70, 140, 180);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(80, 50, 90, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('FACE 1: 96%', 85, 64);

      // Face 2 box
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.strokeRect(340, 90, 150, 190);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(340, 70, 90, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('FACE 2: 91%', 345, 84);

      // Forensic bottom strip
      ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
      ctx.fillRect(0, 458, 640, 22);
      ctx.fillStyle = '#F43F5E';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('[MULTIPLE_FACES]', 8, 473);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '10px monospace';
      ctx.fillText('2026-11-22 22:45:10 UTC • ProctorIQ Forensic Frame', 125, 473);

      return canvas.toDataURL('image/jpeg', 0.7);
    });

    // Trigger MULTIPLE_FACES violation
    const vioRes2 = await request.post(`http://localhost:4001/api/sessions/${sessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        code: 'MULTIPLE_FACES',
        snapshot: multiFaceSnapshotDataUri,
        evidenceMeta: { faceCount: 2 },
      },
    });
    const vioJson2 = await vioRes2.json();
    console.log('VIO JSON 2:', JSON.stringify(vioJson2));
    expect(vioJson2.success).toBe(true);

    // Assert second warning screen with multiple faces snapshot
    await expect(warningOverlay).toBeVisible({ timeout: 10000 });
    const overlayText = await warningOverlay.textContent();
    console.log('WARNING OVERLAY TEXT 2:', overlayText);
    await expect(warningOverlay.locator('text=Multiple faces were detected')).toBeVisible();

    const multiFaceMetrics = await warningOverlay
      .locator('[data-testid="evidence-image-container"] img')
      .evaluate((img: HTMLImageElement) => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return { naturalWidth: 0, naturalHeight: 0, variance: 0 };

        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cx = c.getContext('2d')!;
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, w, h).data;

        let sum = 0;
        const lumas: number[] = [];
        const step = Math.max(1, Math.floor(data.length / 2000));
        for (let i = 0; i < data.length; i += step * 4) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += l;
          lumas.push(l);
        }
        const mean = sum / lumas.length;
        let varSum = 0;
        for (const l of lumas) varSum += (l - mean) ** 2;
        const variance = varSum / lumas.length;

        return { naturalWidth: w, naturalHeight: h, variance };
      });

    console.log('MULTIPLE_FACES Evidence Image Metrics:', JSON.stringify(multiFaceMetrics));
    expect(multiFaceMetrics.naturalWidth).toBeGreaterThan(0);
    expect(multiFaceMetrics.variance).toBeGreaterThan(10);

    // Take screenshot of multiple faces warning
    await studentPage.screenshot({
      path: path.join(docsDir, 'phase19-warning-multiface-snapshot.png'),
    });

    // 9. Verify Proctor Drawer displays the captured snapshots
    await proctorPage.reload();
    await proctorPage.waitForTimeout(1000);

    // Look for student tile
    const studentTile = proctorPage.locator(`[data-testid="student-tile-${sessionId}"]`).first();
    await expect(studentTile).toBeVisible({ timeout: 15000 });
    await studentTile.click();

    // Proctor detail drawer should open
    const drawer = proctorPage.locator('[data-testid="student-detail-drawer"]');
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Assert that the evidence images in the audit ledger have loaded
    const proctorEvidenceImg = drawer.locator('[data-testid="evidence-image-container"] img').first();
    await expect(proctorEvidenceImg).toBeVisible({ timeout: 10000 });

    const proctorImgNaturalWidth = await proctorEvidenceImg.evaluate(
      (img: HTMLImageElement) => img.naturalWidth
    );
    expect(proctorImgNaturalWidth).toBeGreaterThan(0);

    // Take screenshot of proctor drawer showing evidence snapshot
    await proctorPage.screenshot({
      path: path.join(docsDir, 'phase19-proctor-drawer-snapshot.png'),
    });
  });
});
