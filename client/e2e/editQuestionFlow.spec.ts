import { test, expect } from '@playwright/test';

test.describe('Question Edit Icon, Modal & Published Lock Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    await page.waitForURL(/\/home|\/admin/, { timeout: 15000 });
    await page.goto('/admin/exams');
    await expect(page.locator('text=Curated Assessment Directory')).toBeVisible({ timeout: 15000 });
  });

  test('1. Draft Exam: Each question has 36px icon buttons (Edit pencil, Duplicate, Move up/down, Delete); editing updates immediately', async ({
    page,
  }) => {
    // Look for a DRAFT exam card or create a draft exam if none found
    let draftCard = page.locator('.grid > div.rounded-2xl:has-text("DRAFT")').first();
    const hasDraft = (await draftCard.count()) > 0;

    if (!hasDraft) {
      // Create a draft exam via Architect New Examination modal
      await page.click('button:has-text("Architect New Examination")');
      await expect(page.locator('text=1. Exam Details')).toBeVisible();
      await page.fill('input[placeholder*="CS-401"]', `E2E Draft Test ${Date.now()}`);
      await page.fill(
        'textarea[placeholder*="Comprehensive exam scope"]',
        'Detailed syllabus instructions for E2E draft exam testing purposes.'
      );
      await page.click('button:has-text("Save as draft")');
      await page.waitForTimeout(1000);
      await page.goto('/admin/exams');
      draftCard = page.locator('.grid > div.rounded-2xl:has-text("DRAFT")').first();
    }

    await expect(draftCard).toBeVisible({ timeout: 10000 });
    await draftCard.click();
    await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });

    // Wait for Question Bank section
    await expect(page.locator('text=Curated Question Bank')).toBeVisible({ timeout: 10000 });

    // If 0 questions, add one first
    const questionRows = page.locator('div.rounded-xl.border.border-border.bg-background.p-4');
    if ((await questionRows.count()) === 0) {
      await page.click('button:has-text("Add Question")');
      await expect(page.locator('text=Add New Question')).toBeVisible();
      await page.fill('input[placeholder="Question prompt..."]', 'Initial E2E Test Question?');
      await page.fill('input[placeholder="Option A *"]', 'Option Alpha');
      await page.fill('input[placeholder="Option B *"]', 'Option Beta');
      await page.click('button:has-text("Save Question")');
      await expect(questionRows.first()).toBeVisible({ timeout: 10000 });
    }

    const firstRow = questionRows.first();
    await expect(firstRow).toBeVisible();

    // Verify row actions: 36px buttons for Edit (pencil), Duplicate, Move up, Move down, Delete
    const editBtn = firstRow.locator('button[aria-label="Edit question"]');
    const duplicateBtn = firstRow.locator('button[aria-label="Duplicate question"]');
    const moveUpBtn = firstRow.locator('button[aria-label="Move question up"]');
    const moveDownBtn = firstRow.locator('button[aria-label="Move question down"]');
    const deleteBtn = firstRow.locator('button[aria-label="Delete question"]');

    await expect(editBtn).toBeVisible();
    await expect(duplicateBtn).toBeVisible();
    await expect(moveUpBtn).toBeVisible();
    await expect(moveDownBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Verify tooltip on Edit button
    await expect(editBtn).toHaveAttribute('title', 'Edit question');
    await expect(deleteBtn).toHaveAttribute('title', 'Delete question');

    // Click Edit pencil icon button
    await editBtn.click();

    // Verify Edit Question modal opened and is prefilled
    const editModal = page.locator('div[role="dialog"]:has-text("Edit Question")');
    await expect(editModal).toBeVisible({ timeout: 10000 });
    const promptInput = editModal.locator('input[placeholder="Question prompt..."]');
    await expect(promptInput).toBeVisible();
    const originalText = await promptInput.inputValue();
    expect(originalText.length).toBeGreaterThan(0);

    // Save changes button should be disabled initially (not dirty)
    const saveBtn = editModal.locator('button:has-text("Save changes")');
    await expect(saveBtn).toBeDisabled();

    // Edit the question prompt
    const updatedText = `Updated Prompt ${Date.now()}`;
    await promptInput.fill(updatedText);

    // Now save button should be enabled
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify modal closes and updated question text is immediately displayed
    await expect(editModal).not.toBeVisible();
    await expect(page.locator(`text=${updatedText}`)).toBeVisible();
  });

  test('2. Cancel with unsaved edits triggers discard confirmation dialog', async ({ page }) => {
    // Open a draft exam
    const draftCard = page.locator('.grid > div.rounded-2xl:has-text("DRAFT")').first();
    await expect(draftCard).toBeVisible({ timeout: 10000 });
    await draftCard.click();
    await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });

    const firstRow = page.locator('div.rounded-xl.border.border-border.bg-background.p-4').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    // Clicking question text also opens the Edit Question dialog
    const qTextSpan = firstRow.locator('span.text-foreground.font-semibold');
    await qTextSpan.click();

    const editModal = page.locator('div[role="dialog"]:has-text("Edit Question")');
    await expect(editModal).toBeVisible({ timeout: 10000 });

    // Make an unsaved edit
    const promptInput = editModal.locator('input[placeholder="Question prompt..."]');
    await promptInput.fill('Unsaved modifications that will trigger discard confirm');

    // Click Cancel in edit modal
    await editModal.locator('button:has-text("Cancel")').click();

    // Discard confirm dialog appears
    const discardModal = page.locator('div[role="dialog"]:has-text("Discard Unsaved Edits?")');
    await expect(discardModal).toBeVisible({ timeout: 10000 });
    await expect(discardModal.locator('text=You have unsaved edits on this question')).toBeVisible();

    // Click Keep Editing -> stays in edit dialog
    await discardModal.locator('button:has-text("Keep Editing")').click();
    await expect(discardModal).not.toBeVisible();
    await expect(editModal).toBeVisible();

    // Click Cancel -> Discard Changes -> closes edit dialog
    await editModal.locator('button:has-text("Cancel")').click();
    await expect(discardModal).toBeVisible();
    await discardModal.locator('button:has-text("Discard Changes")').click();

    await expect(editModal).not.toBeVisible();
  });

  test('3. Published Exam: Question action icons are disabled with tooltip "Unpublish to edit questions"', async ({
    page,
  }) => {
    // Navigate to a published exam
    const publishedCard = page.locator('.grid > div.rounded-2xl:has-text("PUBLISHED")').first();
    await expect(publishedCard).toBeVisible({ timeout: 10000 });
    await publishedCard.click();
    await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });

    // Verify lock notice
    await expect(page.locator('text=Assessment is PUBLISHED and live')).toBeVisible();

    // Verify "Edit questions" and "Add Question" are disabled
    const addQBtn = page.locator('button:has-text("Add Question")');
    if ((await addQBtn.count()) > 0) {
      await expect(addQBtn).toBeDisabled();
      await expect(addQBtn).toHaveAttribute('title', 'Unpublish to edit questions');
    }

    // Verify question row action buttons are disabled with tooltip
    const questionRows = page.locator('div.rounded-xl.border.border-border.bg-background.p-4');
    if ((await questionRows.count()) > 0) {
      const firstRow = questionRows.first();
      const editBtn = firstRow.locator('button[aria-label="Edit question"]');
      const duplicateBtn = firstRow.locator('button[aria-label="Duplicate question"]');
      const deleteBtn = firstRow.locator('button[aria-label="Delete question"]');

      await expect(editBtn).toBeDisabled();
      await expect(editBtn).toHaveAttribute('title', 'Unpublish to edit questions');
      await expect(duplicateBtn).toBeDisabled();
      await expect(duplicateBtn).toHaveAttribute('title', 'Unpublish to edit questions');
      await expect(deleteBtn).toBeDisabled();
      await expect(deleteBtn).toHaveAttribute('title', 'Unpublish to edit questions');

      // Clicking question text on published exam does not open edit modal
      const qTextSpan = firstRow.locator('span.text-foreground.font-semibold');
      await qTextSpan.click();
      await expect(page.locator('h3:has-text("Edit Question")')).not.toBeVisible();
    }
  });

  test('4. Exam Parameters: Pencil icon toggles edit mode with Save Changes and Discard', async ({
    page,
  }) => {
    // Open a draft exam
    const draftCard = page.locator('.grid > div.rounded-2xl:has-text("DRAFT")').first();
    await expect(draftCard).toBeVisible({ timeout: 10000 });
    await draftCard.click();
    await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });

    // Look for Exam Parameters pencil button
    const paramEditBtn = page.locator('button[aria-label="Edit exam parameters"]');
    await expect(paramEditBtn).toBeVisible({ timeout: 10000 });
    await expect(paramEditBtn).toHaveAttribute('title', 'Edit exam parameters');

    // Click pencil icon
    await paramEditBtn.click();

    // Inputs and Save / Discard buttons are visible
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
    const discardBtn = page.locator('button:has-text("Discard")');
    await expect(discardBtn).toBeVisible();

    // Click Discard -> exits edit mode
    await discardBtn.click();
    await expect(page.locator('button:has-text("Save Changes")')).not.toBeVisible();
    await expect(page.locator('button[aria-label="Edit exam parameters"]')).toBeVisible();
  });
});
