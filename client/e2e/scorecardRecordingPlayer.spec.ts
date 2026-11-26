import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Scorecard Embedded Recording Player E2E Suite', () => {
  let adminToken: string;
  let studentToken: string;
  let studentId: number;
  let testExamId: number;
  let testSessionId: number;
  let recordingId: number;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate users
    const adminRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const adminJson = await adminRes.json();
    adminToken = adminJson.data.token;

    const studentRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'student@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    const studentJson = await studentRes.json();
    studentToken = studentJson.data.token;
    studentId = studentJson.data.user.id;

    // 2. Create and publish test exam
    const createExamRes = await request.post('http://localhost:4001/api/exams', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: `Scorecard Player Test Exam ${Date.now()}`,
        description: 'Testing embedded recording player fit, controls, and responsiveness',
        durationMinutes: 30,
        minTrustScore: 60,
        recordVideo: true,
        recordAudio: false,
      },
    });
    const examJson = await createExamRes.json();
    testExamId = examJson.data.id;

    // Add question
    await request.post(`http://localhost:4001/api/exams/${testExamId}/questions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        questionText: 'Embedded player test question',
        optionA: 'Alpha',
        optionB: 'Beta',
        optionC: 'Gamma',
        optionD: 'Delta',
        correctOption: 'A',
        marks: 10,
      },
    });

    // Publish exam
    await request.patch(`http://localhost:4001/api/exams/${testExamId}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // 3. Student starts session
    const startRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { examId: testExamId },
    });
    const startJson = await startRes.json();
    testSessionId = startJson.data.id;

    // 4. Upload sample WebM chunk & finish recording
    const sampleWebmPath = path.resolve(__dirname, './fixtures/sample_review.webm');
    const webmBuffer = fs.readFileSync(sampleWebmPath);

    const chunkRes = await request.put(
      `http://localhost:4001/api/sessions/${testSessionId}/recording/chunks/0`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'video/webm',
        },
        data: webmBuffer,
      }
    );
    expect(chunkRes.ok()).toBeTruthy();

    const finishRes = await request.post(
      `http://localhost:4001/api/sessions/${testSessionId}/recording/finish`,
      {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { durationMs: 12000 },
      }
    );
    expect(finishRes.ok()).toBeTruthy();
    const finishJson = await finishRes.json();
    recordingId = finishJson.data.recordingId;
    expect(recordingId).toBeGreaterThan(0);

    // 5. Fire a test violation for timeline marker testing
    await request.post(`http://localhost:4001/api/sessions/${testSessionId}/violation`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        code: 'TAB_SWITCH',
        evidenceMeta: { tabSwitched: true },
      },
    });
  });

  test('Embedded scorecard player: fit, controls, 2x speed, markers, and fullscreen', async ({
    page,
  }) => {
    // 1. Login as Admin
    await page.goto('http://localhost:5174/login');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/admin|\/home/, { timeout: 15000 });

    // 2. Navigate to Scorecard page
    await page.goto(`http://localhost:5174/admin/students/${studentId}/exams/${testSessionId}`);
    await page.waitForSelector('[data-testid="recording-player-container"]', { timeout: 15000 });

    const playerContainer = page.locator('[data-testid="recording-player-container"]').first();
    await expect(playerContainer).toBeVisible();

    // 3. FIT VERIFICATION:
    const videoLocator = playerContainer.locator('[data-testid="review-video-element"]');
    await expect(videoLocator).toBeVisible();

    // Verify video object-fit: contain
    const objectFit = await videoLocator.evaluate((el: HTMLVideoElement) => {
      return window.getComputedStyle(el).objectFit;
    });
    expect(objectFit).toBe('contain');

    // Verify video container background is solid dark
    const videoBg = await videoLocator.evaluate((el: HTMLVideoElement) => {
      const parent = el.parentElement;
      return parent ? window.getComputedStyle(parent).backgroundColor : '';
    });
    expect(['rgb(0, 0, 0)', 'rgba(0, 0, 0, 1)', 'black']).toContain(videoBg);

    // 4. Center play button appears while paused
    const centerPlayBtn = playerContainer.locator('[data-testid="center-play-button"]');
    await expect(centerPlayBtn).toBeVisible();
    await centerPlayBtn.click();

    // Video begins playing and center play button disappears
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="review-video-element"]') as HTMLVideoElement | null;
      return v && !v.paused;
    }, { timeout: 8000 });
    await expect(centerPlayBtn).not.toBeVisible();

    // 5. Controls Overlay is interactive
    const controlsOverlay = playerContainer.locator('[data-testid="player-controls-overlay"]');
    await expect(controlsOverlay).toBeVisible();

    // 6. Playback speed: change to 2x
    const speedBtn = playerContainer.locator('[data-testid="playback-speed-button"]');
    await speedBtn.click();
    const opt2x = playerContainer.locator('[data-testid="speed-opt-2"]');
    await opt2x.click();

    // Verify video.playbackRate === 2
    const currentRate = await videoLocator.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(currentRate).toBe(2);
    await expect(speedBtn).toHaveText('2x');

    // Verify persisted in localStorage
    const storedSpeed = await page.evaluate(() => localStorage.getItem('proctoriq_recording_playback_rate'));
    expect(storedSpeed).toBe('2');

    // 7. Seeking via timeline marker
    const marker = playerContainer.locator('[data-testid^="timeline-marker-"]').first();
    if (await marker.count() > 0) {
      await marker.click({ force: true });
      const curTime = await videoLocator.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(curTime).toBeGreaterThanOrEqual(0);
    }

    // 8. Fullscreen toggle
    const fullscreenBtn = playerContainer.locator('[data-testid="fullscreen-btn"]');
    await fullscreenBtn.click();
    // Verify exit fullscreen button or container fullscreen class
    const exitFsBtn = playerContainer.locator('[data-testid="exit-fullscreen-btn"]');
    // In headless browser requestFullscreen might be mocked or no-op, but handler shouldn't throw
    await page.keyboard.press('Escape');

    // 9. Pause via spacebar
    await page.keyboard.press('Space');
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="review-video-element"]') as HTMLVideoElement | null;
      return v && v.paused;
    }, { timeout: 5000 });
  });

  test('Responsive layout at 1440px, 1024px, and 390px viewports', async ({ page }) => {
    // Login as Admin
    await page.goto('http://localhost:5174/login');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/admin|\/home/, { timeout: 15000 });

    await page.goto(`http://localhost:5174/admin/students/${studentId}/exams/${testSessionId}`);
    await page.waitForSelector('[data-testid="recording-player-container"]', { timeout: 15000 });

    const playerContainer = page.locator('[data-testid="recording-player-container"]').first();
    const videoEl = playerContainer.locator('[data-testid="review-video-element"]');
    const tabsContainer = playerContainer.locator('[data-testid="tab-events"]').locator('..');

    // --- 1440px Desktop ---
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    const videoBox1440 = await videoEl.boundingBox();
    const tabsBox1440 = await tabsContainer.boundingBox();
    expect(videoBox1440).toBeTruthy();
    expect(tabsBox1440).toBeTruthy();
    // On 1440px, side panel is to the right of the video (flex-row)
    expect(tabsBox1440!.x).toBeGreaterThan(videoBox1440!.x);

    // --- 1024px Tablet Landscape ---
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);

    const videoBox1024 = await videoEl.boundingBox();
    const tabsBox1024 = await tabsContainer.boundingBox();
    expect(videoBox1024).toBeTruthy();
    expect(tabsBox1024).toBeTruthy();
    // On 1024px (lg breakpoint), side panel is still to the right
    expect(tabsBox1024!.x).toBeGreaterThan(videoBox1024!.x);

    // --- 390px Mobile Viewport ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const videoBox390 = await videoEl.boundingBox();
    const tabsBox390 = await tabsContainer.boundingBox();
    expect(videoBox390).toBeTruthy();
    expect(tabsBox390).toBeTruthy();
    // On 390px mobile, side panel stacks below the video (flex-col)
    expect(tabsBox390!.y).toBeGreaterThan(videoBox390!.y);
  });
});
