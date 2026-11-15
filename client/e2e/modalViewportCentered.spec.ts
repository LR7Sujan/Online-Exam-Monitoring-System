import { test, expect, Page, Locator } from '@playwright/test';

const VIEWPORTS = [
  { name: '1440x900 Desktop', width: 1440, height: 900 },
  { name: '1024x768 Tablet', width: 1024, height: 768 },
  { name: '390x844 Mobile', width: 390, height: 844 },
];

async function loginAsAdmin(page: Page) {
  await page.goto('http://localhost:5173/login');
  await expect(page.locator('text=ProctorIQ Access')).toBeVisible({ timeout: 10000 });
  await page.fill('input[type="email"]', 'admin@proctoriq.io');
  await page.fill('input[type="password"]', 'ProctorIQ#2026');
  await page.click('button:has-text("Authenticate & Enter Console")');
  await page.waitForURL(/\/home|\/admin/, { timeout: 15000 });
}

async function scrollToCatalogBottom(page: Page, scrollAmount = 800) {
  await page.evaluate((amt) => {
    const scrollContainer = document.querySelector('div.overflow-y-auto.h-dvh') as HTMLElement | null;
    if (scrollContainer) {
      scrollContainer.scrollTop = amt;
    }
    window.scrollTo(0, amt);
  }, scrollAmount);
  await page.waitForTimeout(300);
}

async function assertBoundingBoxInViewport(locator: Locator, page: Page, name: string) {
  await expect(locator).toBeVisible({ timeout: 10000 });
  // Wait for entrance spring animation to fully settle at resting position
  await page.waitForTimeout(400);
  const box = await locator.boundingBox();
  expect(box, `${name} bounding box exists`).toBeTruthy();
  const vp = page.viewportSize()!;

  // Must start at or below top of visible window (top >= 0)
  expect(box!.y, `${name} top (${box!.y}) must be >= 0`).toBeGreaterThanOrEqual(-2);

  // Must fit inside visible viewport height
  expect(box!.y + box!.height, `${name} bottom (${box!.y + box!.height}) must fit inside viewport height (${vp.height})`).toBeLessThanOrEqual(vp.height + 4);
}

test.describe('Phase 17: Overlays Centered in Visible Viewport (No Page Scrolling)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('http://localhost:5173/admin/exams');
    await expect(page.locator('text=Curated Assessment Directory')).toBeVisible({ timeout: 15000 });
  });

  for (const vp of VIEWPORTS) {
    test(`1. Architect New Examination modal centered in viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await scrollToCatalogBottom(page, 800);

      // Click Architect New Examination
      const trigger = page.locator('button:has-text("Architect New Examination")').first();
      await trigger.click();

      const modal = page.locator('[role="dialog"]:has-text("Architect New Examination"), [role="dialog"]:has-text("Modify Assessment Specification")').first();
      await assertBoundingBoxInViewport(modal, page, 'Architect New Examination Modal');

      // Close modal
      await page.locator('button[aria-label="Close modal"]').first().click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test(`2. Unpublish confirmation modal centered in viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await scrollToCatalogBottom(page, 800);

      // Find a published exam card with an Unpublish button
      const unpublishBtn = page.locator('button:has-text("Unpublish")').first();
      await expect(unpublishBtn).toBeVisible({ timeout: 10000 });
      await unpublishBtn.click();

      const modal = page.locator('[role="dialog"]:has-text("Unpublish")').first();
      await assertBoundingBoxInViewport(modal, page, 'Unpublish Confirm Modal');

      // Dismiss modal
      const closeBtn = modal.locator('button:has-text("Cancel"), button:has-text("Dismiss")').first();
      await closeBtn.click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test(`3. Status Menu dropdown inside viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await scrollToCatalogBottom(page, 800);

      // Find a draft card status menu trigger
      const draftMenuBtn = page.locator('button[title="Status menu"]').first();
      if ((await draftMenuBtn.count()) > 0) {
        await draftMenuBtn.click();
        const menu = page.locator('[role="menu"]').first();
        await assertBoundingBoxInViewport(menu, page, 'Status Menu Dropdown');

        // Close menu
        await page.keyboard.press('Escape');
        await expect(menu).not.toBeVisible({ timeout: 5000 });
      }
    });

    test(`4. Delete confirm modal centered in viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await scrollToCatalogBottom(page, 800);

      // Open status menu and click Delete permanently
      const draftMenuBtn = page.locator('button[title="Status menu"]').first();
      if ((await draftMenuBtn.count()) > 0) {
        await draftMenuBtn.click();
        const deleteMenuItem = page.locator('[role="menu"] button:has-text("Delete permanently")');
        await deleteMenuItem.click();

        const modal = page.locator('[role="dialog"]:has-text("Delete Examination Permanently")').first();
        await assertBoundingBoxInViewport(modal, page, 'Delete Confirm Modal');

        // Cancel delete modal
        const cancelBtn = modal.locator('button:has-text("Cancel")');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
      }
    });

    test(`5. Notification panel flyout inside viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await scrollToCatalogBottom(page, 800);

      const notifBtn = page.locator('button[aria-label="Notifications"]').first();
      await notifBtn.click();

      const panel = page.locator('[role="dialog"][aria-label="Violation Telemetry Feed"]').first();
      await assertBoundingBoxInViewport(panel, page, 'Notification Panel');

      // Close by pressing Escape
      await page.keyboard.press('Escape');
      await expect(panel).not.toBeVisible({ timeout: 5000 });
    });

    test(`6. Profile account menu inside viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await scrollToCatalogBottom(page, 800);

      const profileBtn = page.locator('button[aria-label="User account menu"]').first();
      await profileBtn.click();

      const panel = page.locator('div[role="dialog"][aria-label="User account menu"]').first();
      await assertBoundingBoxInViewport(panel, page, 'Profile Account Menu');

      // Close by pressing Escape
      await page.keyboard.press('Escape');
      await expect(panel).not.toBeVisible({ timeout: 5000 });
    });

    test(`7. Questions Add/Edit dialog centered in viewport at ${vp.name} after 800px scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Click card to open exam detail page
      const card = page.locator('.grid > div.rounded-2xl').first();
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.click();
      await page.waitForURL(/\/admin\/exams\/\d+/, { timeout: 15000 });

      // Scroll down 800px on detail page
      await scrollToCatalogBottom(page, 800);

      // Check if "Add Question" button exists (or Unpublish first if published)
      const unpublishBtn = page.locator('button:has-text("Unpublish to Edit")');
      if ((await unpublishBtn.count()) > 0) {
        await unpublishBtn.click();
        const confirmBtn = page.locator('button:has-text("Unpublish Exam")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      const addQuestionBtn = page.locator('button:has-text("Add Question")').first();
      if (await addQuestionBtn.isVisible()) {
        await addQuestionBtn.click();

        const modal = page.locator('[role="dialog"]:has-text("Add New Question")').first();
        await assertBoundingBoxInViewport(modal, page, 'Question Add/Edit Dialog');

        // Close modal
        await modal.locator('button:has-text("Cancel")').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
      }
    });
  }
});
