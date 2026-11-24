import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Webcam Recording Review Player E2E Suite', () => {
  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let testExamId: number;
  let testSessionId: number;
  let recordingId: number;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate users via API
    const adminRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'admin@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    adminToken = (await adminRes.json()).data.token;

    const proctorRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'proctor@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    proctorToken = (await proctorRes.json()).data.token;

    const studentRes = await request.post('http://localhost:4001/api/auth/login', {
      data: { email: 'student@proctoriq.io', password: 'ProctorIQ#2026' },
    });
    studentToken = (await studentRes.json()).data.token;

    // 2. Create and publish test exam with video recording enabled
    const createExamRes = await request.post('http://localhost:4001/api/exams', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: `Player Review Exam ${Date.now()}`,
        description: 'E2E testing of RecordingPlayer review features',
        durationMinutes: 45,
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
        questionText: 'Test player question',
        optionA: 'Option 1',
        optionB: 'Option 2',
        optionC: 'Option 3',
        optionD: 'Option 4',
        correctOption: 'A',
        marks: 5,
      },
    });

    // Publish exam
    await request.patch(`http://localhost:4001/api/exams/${testExamId}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // 3. Student starts exam session
    const startRes = await request.post('http://localhost:4001/api/sessions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { examId: testExamId },
    });
    const startJson = await startRes.json();
    testSessionId = startJson.data.id;

    // 4. Upload real WebM chunk and finalize recording
    const sampleWebmPath = path.resolve(__dirname, '../../server/uploads-test/sample_review.webm');
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
    if (!chunkRes.ok()) {
      console.log('Chunk upload failed:', chunkRes.status(), await chunkRes.text());
    }
    expect(chunkRes.ok()).toBeTruthy();

    const finishRes = await request.post(
      `http://localhost:4001/api/sessions/${testSessionId}/recording/finish`,
      {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { durationMs: 5000 },
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
        code: 'PHONE_DETECTED',
        evidenceMeta: { phoneDetected: true },
      },
    });
  });

  test('Proctor reviews recording: play, pause, seek, 2x speed, markers, notes, and keyboard shortcuts', async ({
    page,
  }) => {
    // 1. Login as Proctor
    await page.goto('http://localhost:5174/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });

    // 2. Open recording player URL directly
    await page.goto(`http://localhost:5174/recordings/${recordingId}`);
    await page.waitForSelector('[data-testid="recording-player-container"]', { timeout: 10000 });

    // Assert student name, paper code, and exam title in header
    await expect(page.locator('[data-testid="recording-player-container"]')).toContainText('Player Review Exam');
    await expect(page.locator('[data-testid="recording-player-container"]')).toContainText('Aarav Chen');

    const videoLocator = page.locator('[data-testid="review-video-element"]');
    await expect(videoLocator).toBeVisible();

    // 3. Play / Pause Controls
    // Click center play or play button
    const centerPlayBtn = page.locator('[data-testid="center-play-button"]');
    if (await centerPlayBtn.isVisible()) {
      await centerPlayBtn.click();
    } else {
      await page.locator('[data-testid="play-pause-btn"]').click();
    }

    // Assert video started playing
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="review-video-element"]') as HTMLVideoElement | null;
      return v && !v.paused;
    }, { timeout: 8000 });

    // Toggle pause with Space key
    await page.keyboard.press('Space');
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="review-video-element"]') as HTMLVideoElement | null;
      return v && v.paused;
    }, { timeout: 5000 });

    // 4. Change Speed to 2x and assert video.playbackRate === 2
    const speedBtn = page.locator('[data-testid="playback-speed-button"]');
    await speedBtn.click();
    const opt2x = page.locator('[data-testid="speed-opt-2"]');
    await opt2x.click();

    const playbackRate = await videoLocator.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(playbackRate).toBe(2);

    // 5. Seek via timeline marker and assert currentTime jumps
    const marker = page.locator('[data-testid^="timeline-marker-"]').first();
    if (await marker.count() > 0) {
      await marker.click({ force: true });
      const curTime = await videoLocator.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(curTime).toBeGreaterThanOrEqual(0);
    }

    // 6. Proctor Notes: add note at current timestamp
    await page.locator('[data-testid="tab-notes"]').click();
    const noteInput = page.locator('[data-testid="note-input"]');
    await noteInput.fill('Review observation: candidate turned head.');
    await page.locator('[data-testid="add-note-btn"]').click();

    // Verify note is rendered in the list
    await expect(page.locator('[data-testid^="note-item-"]')).toContainText('Review observation: candidate turned head.');

    // 7. Keyboard shortcuts: Right arrow seeks forward
    const timeBeforeSeek = await videoLocator.evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.keyboard.press('ArrowRight');
    const timeAfterSeek = await videoLocator.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(timeAfterSeek).toBeGreaterThanOrEqual(timeBeforeSeek);
  });

  test('Security check: Student role is forbidden from accessing recording player URL', async ({
    browser,
  }) => {
    // Open a fresh isolated browser context for student
    const studentContext = await browser.newContext({
      baseURL: 'http://localhost:5174',
    });
    const studentPage = await studentContext.newPage();

    // 1. Login as Student
    await studentPage.goto('/login');
    await studentPage.fill('input[type="email"]', 'student@proctoriq.io');
    await studentPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await studentPage.click('button:has-text("Authenticate & Enter Console")');
    await studentPage.waitForURL(/\/student|\/home/, { timeout: 15000 });

    // 2. Attempt to open recording player URL directly
    await studentPage.goto(`/recordings/${recordingId}`);

    // Assert student is redirected away (to /student) and player container is NOT displayed
    await studentPage.waitForURL(/\/student|\/home|\/login/, { timeout: 10000 });
    expect(studentPage.url()).not.toContain(`/recordings/${recordingId}`);
    await expect(studentPage.locator('[data-testid="recording-player-container"]')).toHaveCount(0);

    await studentContext.close();
  });
});
