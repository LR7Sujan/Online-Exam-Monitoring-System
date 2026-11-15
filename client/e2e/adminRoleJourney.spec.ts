import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Admin Role Complete User Journey', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
          console.error(`[Browser Console Error] ${text}`);
        }
      }
    });
  });

  test('ADMIN: login -> overview -> exam wizard (manual + valid/malformed CSV) -> edit penalty weight -> users table -> results CSV export', async ({
    page,
    request,
  }) => {
    // 1. Authenticate as Admin
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });

    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    // 2. Admin Overview Dashboard
    await page.waitForURL(/\/home|\/admin/, { timeout: 15000 });
    if (page.url().includes('/home')) {
      await page.goto('/admin');
    }
    await expect(page.locator('text=Administrator Console')).toBeVisible();
    await expect(page.locator('text=Governance & Intelligence Deck')).toBeVisible();
    await expect(page.locator('text=Registered Students')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Total Curated Exams')).toBeVisible();

    // 3. Switch to Exam Manager Tab & Launch Exam Wizard
    await page.click('button:has-text("Exam Manager")');
    await expect(page.locator('text=Curated Assessment Directory')).toBeVisible({ timeout: 10000 });

    const newExamBtn = page.locator('button:has-text("Architect New Examination")');
    await newExamBtn.click();

    // Modal opens
    await expect(page.locator('text=EXAMINATION TITLE *')).toBeVisible({ timeout: 10000 });

    // Step 1: Details
    const examTitle = `Automated E2E Exam ${Date.now()}`;
    await page.fill('input[placeholder*="CS-401"]', examTitle);
    await page.fill('textarea[placeholder*="Comprehensive exam scope"]', 'Testing full wizard lifecycle and question ingestion');
    await page.click('button:has-text("Continue")');

    // Step 2: Windows & Threshold
    await expect(page.locator('text=Minimum Authoritative Trust Score')).toBeVisible();
    await page.click('button:has-text("Continue")');

    // Step 3: Questions Ingestion
    await expect(page.locator('text=Curated Questions')).toBeVisible();

    // 3a. Manual Question Entry
    await page.fill('input[placeholder*="Question prompt"]', 'What is the primary key property in relational databases?');
    await page.fill('input[placeholder="Option A *"]', 'Uniquely identifies each record');
    await page.fill('input[placeholder="Option B *"]', 'Allows duplicate values');
    await page.fill('input[placeholder="Option C"]', 'Nullable by default');
    await page.fill('input[placeholder="Option D"]', 'Shared across tables');
    await page.click('button:has-text("Add")');

    // Verify 1 question staged
    await expect(page.locator('text=Curated Questions (1 Staged)')).toBeVisible();

    // 3b. CSV Import Mode: Malformed CSV Handling
    await page.click('button:has-text("Bulk CSV Import")');
    await expect(page.locator('text=PASTE CSV DATA')).toBeVisible();

    // Enter malformed CSV (missing required columns)
    const malformedCsv = `invalid line without columns\nanother invalid line`;
    await page.fill('textarea[placeholder*="question_text,option_a"]', malformedCsv);
    await page.click('button:has-text("Parse & Stage Questions")');

    // Verify user-facing validation error message displays
    await expect(page.locator('text=No valid question rows found')).toBeVisible();

    // 3c. Valid CSV Import
    const validCsv = `"What is ACID atomicity?","All operations succeed or all fail","Automatic concurrency","Any database engine","Asynchronous replication","A",2`;
    await page.fill('textarea[placeholder*="question_text,option_a"]', validCsv);
    await page.click('button:has-text("Parse & Stage Questions")');

    // Preview table displays valid row; click Import valid row
    await page.click('button:has-text("Import")');

    // Verify now 2 staged questions
    await expect(page.locator('text=Curated Questions (2 Staged)')).toBeVisible();

    // 3d. Finalize and Publish Exam
    await page.click('button:has-text("Publish & Finalize Assessment")');
    await expect(page.locator('text=EXAMINATION TITLE *')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${examTitle}`).first()).toBeVisible({ timeout: 10000 });

    // 4. Switch to Rules & Simulator Tab: Edit Penalty Weight
    await page.click('button:has-text("Rules & Simulator")');
    await expect(page.locator('text=Configured Penalty Rules')).toBeVisible({ timeout: 10000 });

    // Find COPY_PASTE row and change its penalty points
    const copyPasteRow = page.locator('tr:has-text("COPY_PASTE")');
    await expect(copyPasteRow).toBeVisible();

    const penaltyInput = copyPasteRow.locator('input[type="number"]');
    const currentVal = await penaltyInput.inputValue();
    const targetPenalty = currentVal === '25' ? '18' : '25';
    await penaltyInput.fill(targetPenalty);

    const saveWeightBtn = copyPasteRow.locator('button:has-text("Save")');
    await saveWeightBtn.click();
    await expect(copyPasteRow.locator('text=Deployed')).toBeVisible({ timeout: 5000 });

    // Confirm DB has updated penalty_points via API
    const authRaw = await page.evaluate(() => localStorage.getItem('proctoriq_auth_v1'));
    const token = authRaw ? JSON.parse(authRaw).token : '';
    const vtRes = await request.get('http://localhost:4000/api/violation-types', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const vtJson = await vtRes.json();
    const copyPasteVt = vtJson.data.find((v: { code: string }) => v.code === 'COPY_PASTE');
    expect(copyPasteVt.penalty_points).toBe(Number(targetPenalty));

    // 5. Switch to User Directory Tab
    await page.click('button:has-text("User Directory")');
    await expect(page.locator('input[placeholder*="Search candidate or staff"]')).toBeVisible({ timeout: 10000 });

    // Filter by role
    await page.click('button:has-text("STUDENTs")');
    await page.waitForTimeout(300);

    // Search user
    const userSearchInput = page.locator('input[placeholder*="Search candidate or staff"]').first();
    await userSearchInput.fill('Aarav');
    await page.waitForTimeout(300);
    await expect(page.locator('text=student@proctoriq.io').first()).toBeVisible();

    // 6. Switch to Results & Exports Tab: Verify CSV Export
    await page.click('button:has-text("Results & Exports")');
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible({ timeout: 10000 });

    // Download CSV export
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export CSV")');
    const download = await downloadPromise;

    // Verify downloaded file name and content
    expect(download.suggestedFilename()).toContain('proctoriq-audit-report');
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();

    if (downloadedPath) {
      const csvContent = fs.readFileSync(downloadedPath, 'utf-8');
      expect(csvContent.length).toBeGreaterThan(50);
      expect(csvContent).toMatch(/Session ID|Log ID|Student|Violation/i);
    }
  });
});
