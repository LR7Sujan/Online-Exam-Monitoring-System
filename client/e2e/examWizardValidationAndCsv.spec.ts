import { test, expect } from '@playwright/test';

test.describe('Exam Wizard Required-Field Validation & CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    await page.waitForURL('**/home', { timeout: 15000 });
    await page.goto('/admin');
    await expect(page.locator('text=Administrator Console')).toBeVisible();

    // Switch to Exam Manager Tab
    await page.click('button:has-text("Exam Manager")');
    await expect(page.locator('text=Curated Assessment Directory')).toBeVisible({ timeout: 10000 });
  });

  test('1. Blank wizard cannot publish and lists every missing item in "Before you can publish" panel', async ({
    page,
  }) => {
    await page.click('button:has-text("Architect New Examination")');
    await expect(page.locator('text=EXAMINATION TITLE *')).toBeVisible();

    // Directly click "Publish & Finalize Assessment" (available in Step 3 or when clicked)
    // First navigate to step 3 or click publish
    // Step tabs 2 and 3 cannot be clicked ahead of invalid step 1
    await page.click('button:has-text("3. Questions & CSV")');
    // Still on step 1 because step 1 is invalid!
    await expect(page.locator('text=EXAMINATION TITLE *')).toBeVisible();

    // Clicking continue blocks and shows inline errors
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Title is required')).toBeVisible();
    await expect(page.locator('text=Syllabus/instructions is required')).toBeVisible();

    // Fill valid title but syllabus with < 20 chars
    await page.fill('input#exam-wizard-title', 'Valid Test Exam Title');
    await page.fill('textarea#exam-wizard-description', 'Only 12 chars');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Syllabus must be at least 20 characters')).toBeVisible();

    // Check aria-invalid
    const titleInput = page.locator('input#exam-wizard-title');
    await expect(titleInput).toHaveAttribute('aria-invalid', 'false');
    const descInput = page.locator('textarea#exam-wizard-description');
    await expect(descInput).toHaveAttribute('aria-invalid', 'true');

    // Fill complete syllabus
    await page.fill(
      'textarea#exam-wizard-description',
      'Comprehensive syllabus containing over twenty characters for testing validation'
    );
    await page.click('button:has-text("Continue")');

    // Now on step 2
    await expect(page.locator('text=Minimum Authoritative Trust Score')).toBeVisible();
    await page.click('button:has-text("Continue")');

    // Now on step 3
    await expect(page.locator('text=Curated Questions (0 Staged)')).toBeVisible();

    // Attempt to publish with 0 questions
    await page.click('button:has-text("Publish & Finalize Assessment")');

    // "Before you can publish" panel opens!
    await expect(page.locator('text=Before you can publish')).toBeVisible();
    await expect(page.locator('text=At least 1 question is required to publish an assessment')).toBeVisible();

    // Click "Fix field" link -> jumps to step 3 and focuses question prompt
    await page.click('button:has-text("Curated Questions")');
    await expect(page.locator('text=Before you can publish')).not.toBeVisible();
    await expect(page.locator('input#exam-wizard-new-qtext')).toBeFocused();
  });

  test('2. "Save as draft" only requires title and creates an uncompleted draft', async ({
    page,
  }) => {
    await page.click('button:has-text("Architect New Examination")');
    await expect(page.locator('text=EXAMINATION TITLE *')).toBeVisible();

    // Clicking "Save as draft" with empty title fails and shows error
    await page.click('button:has-text("Save as draft")');
    await expect(page.locator('text=Title is required')).toBeVisible();

    const draftTitle = `Draft Assessment ${Date.now()}`;
    await page.fill('input#exam-wizard-title', draftTitle);

    // Click "Save as draft"
    await page.click('button:has-text("Save as draft")');

    // Modal closes
    await expect(page.locator('text=EXAMINATION TITLE *')).not.toBeVisible({ timeout: 10000 });
    // Exam appears in directory as DRAFT
    await expect(page.locator(`text=${draftTitle}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('3. CSV Import parses Example CSV, shows preview table, and stages rows', async ({
    page,
  }) => {
    await page.click('button:has-text("Architect New Examination")');

    // Fill Step 1
    await page.fill('input#exam-wizard-title', `CSV Ingestion Test ${Date.now()}`);
    await page.fill(
      'textarea#exam-wizard-description',
      'Comprehensive syllabus containing over twenty characters for testing validation'
    );
    await page.click('button:has-text("Continue")');

    // Step 2
    await expect(page.locator('text=Minimum Authoritative Trust Score')).toBeVisible();
    await page.click('button:has-text("Continue")');

    // Step 3: Open CSV mode
    await page.click('button:has-text("Bulk CSV Import")');
    await expect(page.locator('text=PASTE CSV DATA')).toBeVisible();

    // Check Template download link is visible
    await expect(page.locator('button:has-text("Download template")')).toBeVisible();

    // Click "Insert Example CSV"
    await page.click('button:has-text("Insert Example CSV")');

    // Click Parse
    await page.click('button:has-text("Parse & Stage Questions")');

    // Preview table must be visible with summary strip
    await expect(page.locator('text=2 valid, 0 invalid rows found')).toBeVisible();
    await expect(page.locator('text=Atomicity Consistency Isolation Durability')).toBeVisible();
    await expect(page.locator('text=Which isolation level prevents dirty reads')).toBeVisible();

    // Import valid rows
    await page.click('button:has-text("Import 2 Valid Rows")');

    // Verified staged count
    await expect(page.locator('text=Curated Questions (2 Staged)')).toBeVisible();

    // Now publish the exam with 2 questions!
    await page.click('button:has-text("Publish & Finalize Assessment")');
    await expect(page.locator('text=EXAMINATION TITLE *')).not.toBeVisible({ timeout: 10000 });
  });
});
