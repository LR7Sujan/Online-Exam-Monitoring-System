import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Student Audit, Profile & Scorecard End-to-End Suite', () => {
  let adminToken: string;
  let proctorToken: string;
  let studentToken: string;
  let studentUserId: number;
  let testExamId: number;
  let testSessionId: number;
  let recordingId: number;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate users via API against dedicated test server (port 4001)
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
    const studentData = (await studentRes.json()).data;
    studentToken = studentData.token;
    studentUserId = studentData.user.id;

    // 2. Create exam with questions, shuffling, and video recording enabled
    const createExamRes = await request.post('http://localhost:4001/api/exams', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: `Forensic Audit Exam ${Date.now()}`,
        description: 'E2E testing of student audit, profile, and scorecard flows',
        durationMinutes: 45,
        minTrustScore: 60,
        shuffleQuestions: true,
        shuffleOptions: true,
        recordVideo: true,
        recordAudio: false,
      },
    });
    testExamId = (await createExamRes.json()).data.id;

    // Add Question 1
    await request.post(`http://localhost:4001/api/exams/${testExamId}/questions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        questionText: 'What is the primary key of the Users table?',
        optionA: 'id',
        optionB: 'email',
        optionC: 'token',
        optionD: 'role',
        correctOption: 'A',
        marks: 5,
      },
    });

    // Add Question 2
    await request.post(`http://localhost:4001/api/exams/${testExamId}/questions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        questionText: 'Which protocol secures WebSockets?',
        optionA: 'WSS',
        optionB: 'FTP',
        optionC: 'SMTP',
        optionD: 'DNS',
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
    testSessionId = (await startRes.json()).data.id;

    // 4. Upload real WebM chunk and finalize recording
    const sampleWebmPath = path.resolve(__dirname, '../../server/uploads-test/sample_review.webm');
    const webmBuffer = fs.readFileSync(sampleWebmPath);

    await request.put(
      `http://localhost:4001/api/sessions/${testSessionId}/recording/chunks/0`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'video/webm',
        },
        data: webmBuffer,
      }
    );

    const finishRes = await request.post(
      `http://localhost:4001/api/sessions/${testSessionId}/recording/finish`,
      {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { durationMs: 4000 },
      }
    );
    recordingId = (await finishRes.json()).data.recordingId;

    // 5. Submit an answer for Q1
    const sessQuestionsRes = await request.get(
      `http://localhost:4001/api/sessions/${testSessionId}/questions`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const questions = (await sessQuestionsRes.json()).data.questions;
    const qUsers = questions.find((q: { question_text: string }) => q.question_text.includes('Users'))!;

    let selectedLetter = 'A';
    if (qUsers.option_a === 'id') selectedLetter = 'A';
    else if (qUsers.option_b === 'id') selectedLetter = 'B';
    else if (qUsers.option_c === 'id') selectedLetter = 'C';
    else if (qUsers.option_d === 'id') selectedLetter = 'D';

    await request.put(`http://localhost:4001/api/sessions/${testSessionId}/answer`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        questionId: qUsers.id,
        selectedOption: selectedLetter,
      },
    });

    // 6. Submit and complete exam
    await request.post(`http://localhost:4001/api/sessions/${testSessionId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
  });

  test('Full Journey: Student Audit List -> Profile -> Scorecard with Recording Player & PDF Export', async ({
    page,
  }) => {
    // 1. Login as Proctor
    await page.goto('http://localhost:5174/login');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });

    // 2. Navigate to Student Audit via sidebar or direct URL
    await page.goto('http://localhost:5174/proctor/students');
    await page.waitForSelector('[data-testid="student-audit-table"]', { timeout: 10000 });

    // Assert page title and table
    await expect(page.locator('h1')).toContainText('Candidate Intelligence & Audit');

    // 3. Search for the student
    const searchInput = page.locator('[data-testid="student-search-input"]');
    await searchInput.fill('Aarav Chen');
    await page.waitForTimeout(500);

    const studentRow = page.locator(`[data-testid="student-row-${studentUserId}"]`);
    await expect(studentRow).toBeVisible();
    await expect(studentRow).toContainText('Aarav Chen');

    // 4. Click candidate to open Student Profile
    await studentRow.click();
    await page.waitForURL(new RegExp(`/proctor/students/${studentUserId}`), { timeout: 10000 });

    // Assert Student Profile components
    await expect(page.locator('[data-testid="student-profile-name"]')).toContainText('Aarav Chen');
    await expect(page.locator('text=Exams Attended')).toBeVisible();
    await expect(page.locator('text=Average Score')).toBeVisible();
    await expect(page.locator('text=Average Trust')).toBeVisible();
    await expect(page.locator('text=Clean Rate')).toBeVisible();

    // Assert Attended Examinations table
    const attendedTable = page.locator('[data-testid="attended-exams-table"]');
    await expect(attendedTable).toBeVisible();

    const sessionRow = page.locator(`[data-testid="session-row-${testSessionId}"]`);
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow).toContainText('Forensic Audit Exam');

    // 5. Click attended exam to open Exam Scorecard
    await sessionRow.click();
    await page.waitForURL(new RegExp(`/proctor/students/${studentUserId}/exams/${testSessionId}`), {
      timeout: 10000,
    });

    // Assert Scorecard Header and components
    await expect(page.locator('[data-testid="scorecard-exam-title"]')).toContainText('Forensic Audit Exam');
    await expect(page.locator('text=Score / Total')).toBeVisible();
    await expect(page.locator('text=Percentage')).toBeVisible();
    await expect(page.locator('text=Cohort Rank')).toBeVisible();
    await expect(page.locator('text=Integrity Audit')).toBeVisible();

    // Assert Question-by-question evaluation
    const questionsTable = page.locator('[data-testid="scorecard-questions-table"]');
    await expect(questionsTable).toBeVisible();
    await expect(questionsTable).toContainText('Users table');

    // Assert Webcam Exam Recording section with embedded player
    await expect(page.locator('text=Webcam Exam Recording')).toBeVisible();
    const videoLocator = page.locator('[data-testid="review-video-element"]');
    await expect(videoLocator).toBeVisible();

    // Assert Print / PDF Export button exists
    const printBtn = page.locator('[data-testid="print-scorecard-btn"]');
    await expect(printBtn).toBeVisible();
  });

  test('Security check: Student role is forbidden from accessing student audit directory', async ({
    browser,
  }) => {
    const studentContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const studentPage = await studentContext.newPage();

    // 1. Login as Student
    await studentPage.goto('/login');
    await studentPage.fill('input[type="email"]', 'student@proctoriq.io');
    await studentPage.fill('input[type="password"]', 'ProctorIQ#2026');
    await studentPage.click('button:has-text("Authenticate & Enter Console")');
    await studentPage.waitForURL(/\/student|\/home/, { timeout: 15000 });

    // 2. Attempt to open Student Audit list directly
    await studentPage.goto('http://localhost:5174/proctor/students');
    await studentPage.waitForURL((url) => !url.pathname.includes('/proctor/students'), { timeout: 10000 });
    expect(studentPage.url()).not.toContain('/proctor/students');
    await expect(studentPage.locator('[data-testid="student-audit-table"]')).toHaveCount(0);

    await studentContext.close();
  });
});
