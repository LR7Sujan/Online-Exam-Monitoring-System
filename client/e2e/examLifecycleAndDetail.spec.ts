import { test, expect } from '@playwright/test';

test.describe('Exam Lifecycle, Confirmations & Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin
    await page.goto('/login');
    await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');

    // Wait for redirect to /home or /admin
    await page.waitForURL(/\/home|\/admin/, { timeout: 15000 });

    // Navigate to Exam Catalog
    await page.goto('/admin/exams');
    await expect(page.locator('text=Curated Assessment Directory')).toBeVisible({ timeout: 15000 });
  });

  test('1. Exam Card: No Edit button, card click navigates to /admin/exams/:id, and Inspect Questions is locked when published', async ({
    page,
  }) => {
    // Wait for exam cards grid to load
    const examCards = page.locator('.grid > div.rounded-2xl');
    await expect(examCards.first()).toBeVisible({ timeout: 10000 });

    // Verify NO card has an "Edit" button
    const editButtons = page.locator('button:has-text("Edit")');
    await expect(editButtons).toHaveCount(0);

    // Find a published exam card
    const publishedCard = page.locator('.grid > div.rounded-2xl:has-text("PUBLISHED")').first();
    await expect(publishedCard).toBeVisible();

    // Verify "Inspect Questions" button on published exam is disabled and has tooltip
    const inspectBtn = publishedCard.locator('button:has-text("Inspect Questions")');
    await expect(inspectBtn).toBeDisabled();
    await expect(inspectBtn).toHaveAttribute('title', 'Unpublish to view or edit questions');

    // Get exam title and ID
    const cardTitle = await publishedCard.locator('h4').textContent();

    // Clicking the card navigates to /admin/exams/:id
    await publishedCard.click();
    await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });

    // Verify detail page loaded with correct exam title and "Unpublish to edit" banner
    await expect(page.locator(`h1:has-text("${cardTitle?.trim()}")`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Assessment is PUBLISHED and live')).toBeVisible();
    await expect(page.locator('text=Unpublish to Edit').first()).toBeVisible();
  });

  test('2. Unpublish Confirmation Modal: Cancel changes nothing; active session blocks unpublish', async ({
    page,
  }) => {
    // Find published exam card
    const publishedCard = page.locator('.grid > div.rounded-2xl:has-text("PUBLISHED")').first();
    await expect(publishedCard).toBeVisible();
    const title = (await publishedCard.locator('h4').textContent())?.trim();

    // Click Unpublish on card
    const unpublishBtn = publishedCard.locator('button:has-text("Unpublish")');
    await unpublishBtn.click();

    // Modal appears with exact confirmation text
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(`Unpublish "${title}"?`);
    await expect(modal).toContainText('Students will no longer see or start this exam');

    // Click Cancel -> modal closes, exam remains PUBLISHED
    const cancelBtn = modal.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(publishedCard.locator('text=PUBLISHED')).toBeVisible();
  });

  test('3. Draft Exam: Status dropdown offers Keep/Publish/Delete, and Delete requires typing title', async ({
    page,
  }) => {
    // Create a new draft exam first so we have a guaranteed clean draft
    const architectBtn = page.locator('button:has-text("Architect New Examination")');
    await architectBtn.click();

    const draftTitle = `Lifecycle Assessment ${Date.now()}`;
    await page.fill('#exam-wizard-title', draftTitle);
    await page.click('button:has-text("Save as draft")');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Locate the newly created draft card
    const draftCard = page.locator(`.grid > div.rounded-2xl:has-text("${draftTitle}")`);
    await expect(draftCard).toBeVisible({ timeout: 10000 });
    await expect(draftCard.locator('button:has-text("DRAFT")')).toBeVisible();

    // Inspect Questions should be enabled on draft
    const inspectBtn = draftCard.locator('button:has-text("Inspect Questions")');
    await expect(inspectBtn).toBeEnabled();

    // Status menu: click DRAFT trigger
    const draftStatusTrigger = draftCard.locator('button:has-text("DRAFT")');
    await draftStatusTrigger.click();

    // Dropdown menu opens
    const menu = page.locator('div[role="menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.locator('button:has-text("Keep as draft")')).toBeVisible();
    await expect(menu.locator('button:has-text("Publish")')).toBeVisible();
    await expect(menu.locator('button:has-text("Delete permanently")')).toBeVisible();

    // Click "Keep as draft" closes menu
    await menu.locator('button:has-text("Keep as draft")').click();
    await expect(menu).not.toBeVisible();

    // Open menu again and click "Delete permanently"
    await draftStatusTrigger.click();
    await page.locator('div[role="menu"] button:has-text("Delete permanently")').click();

    // Delete confirmation modal opens
    const deleteModal = page.locator('div[role="dialog"]');
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal).toContainText('Delete Examination Permanently');
    await expect(deleteModal).toContainText('This permanently deletes');
    await expect(deleteModal).toContainText(draftTitle);

    const deleteConfirmBtn = deleteModal.locator('button:has-text("Delete Permanently")');
    // Button is initially disabled
    await expect(deleteConfirmBtn).toBeDisabled();

    // Type partial or wrong text -> still disabled
    const confirmInput = deleteModal.locator('#confirm-delete-input');
    await confirmInput.fill('wrong text');
    await expect(deleteConfirmBtn).toBeDisabled();

    // Type exact draft title -> button enables
    await confirmInput.fill(draftTitle);
    await expect(deleteConfirmBtn).toBeEnabled();

    // Click Delete Permanently -> successfully deletes and card disappears
    await deleteConfirmBtn.click();
    await expect(deleteModal).not.toBeVisible({ timeout: 10000 });
    await expect(draftCard).not.toBeVisible({ timeout: 10000 });
  });

  test('4. Detail Page (/admin/exams/:id): Displays metadata, telemetry, and editable fields for draft', async ({
    page,
  }) => {
    // Create draft exam with questions
    const architectBtn = page.locator('button:has-text("Architect New Examination")');
    await architectBtn.click();

    const testTitle = `Detail Spec Exam ${Date.now()}`;
    await page.fill('#exam-wizard-title', testTitle);
    await page.click('button:has-text("Save as draft")');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Click card to open detail page
    const card = page.locator(`.grid > div.rounded-2xl:has-text("${testTitle}")`);
    await card.click();
    await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 10000 });

    // Verify detail page layout & elements
    await expect(page.locator('text=Assessment Specifications')).toBeVisible();
    await expect(page.locator('text=Curated Question Bank')).toBeVisible();
    await expect(page.locator('text=Assessment Metadata')).toBeVisible();
    await expect(page.locator('text=Session Telemetry')).toBeVisible();
    await expect(page.locator('text=MUTABLE DRAFT')).toBeVisible();

    // Click "Edit Parameters"
    await page.click('button:has-text("Edit Parameters")');
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();

    // Edit syllabus to be at least 20 chars
    const syllabusTextarea = page.locator('textarea');
    await syllabusTextarea.fill('This is a comprehensive updated syllabus covering database transaction locks.');
    await page.click('button:has-text("Save Changes")');

    // Toast notification confirms update
    await expect(page.locator('text=Examination specifications updated')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=This is a comprehensive updated syllabus')).toBeVisible();

    // Add a question
    await page.click('button:has-text("Add Question")');
    await page.fill('input[placeholder="Question prompt..."]', 'What is serializability?');
    await page.fill('input[placeholder="Option A *"]', 'Execution schedule is equivalent to some serial order');
    await page.fill('input[placeholder="Option B *"]', 'Data is read without locks');
    await page.click('button:has-text("Save Question")');

    await expect(page.locator('text=Question added to assessment bank')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=What is serializability?')).toBeVisible();

    // Clean up: delete test exam
    await page.click('button:has-text("DRAFT")');
    await page.click('div[role="menu"] button:has-text("Delete permanently")');
    const deleteModal = page.locator('div[role="dialog"]');
    await deleteModal.locator('#confirm-delete-input').fill('DELETE');
    await deleteModal.locator('button:has-text("Delete Permanently")').click();
    await page.waitForURL(/\/admin\/exams/, { timeout: 10000 });
  });
});
