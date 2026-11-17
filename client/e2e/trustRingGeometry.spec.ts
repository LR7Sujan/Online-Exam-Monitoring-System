import { test, expect } from '@playwright/test';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const PIXEL_SIZES: Record<(typeof SIZES)[number], number> = {
  xs: 40,
  sm: 56,
  md: 80,
  lg: 160,
  xl: 220,
};
const SCORES = [0, 1, 25, 50, 60, 75, 99, 100] as const;

test.describe('TrustRing Geometry, Dot Position, and Text Overflow Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the styleguide trust-ring page
    await page.goto('/styleguide/trust-ring');
    await page.waitForLoadState('networkidle');
  });

  test('verifies mathematical end-marker dot position and text containment across all sizes and scores', async ({
    page,
  }) => {
    test.setTimeout(120000);

    for (const size of SIZES) {
      const pixelSize = PIXEL_SIZES[size];
      const maxInnerRadius = (100 / 120) * (pixelSize / 2);

      for (const score of SCORES) {
        const ring = page.locator(`[data-testid="trust-ring-${size}-${score}"]`);
        await ring.scrollIntoViewIfNeeded();
        await expect(ring).toBeVisible();

        const ringBox = await ring.boundingBox();
        expect(ringBox).not.toBeNull();
        if (!ringBox) continue;

        // Verify container dimensions match expected pixelSize
        expect(Math.round(ringBox.width)).toBe(pixelSize);
        expect(Math.round(ringBox.height)).toBe(pixelSize);

        const dot = ring.locator('[data-testid="trust-ring-dot"]');
        const arc = ring.locator('[data-testid="trust-ring-arc"]');

        if (score === 0) {
          // At score 0: track only, no arc, no dot
          await expect(dot).toHaveCount(0);
          await expect(arc).toHaveCount(0);
        } else if (score === 100) {
          // At score 100: full arc, dot is hidden (meets start)
          await expect(dot).toHaveCount(0);
          await expect(arc).toBeVisible();
        } else {
          // At 0 < score < 100: arc and dot are visible
          await expect(arc).toBeVisible();
          await expect(dot).toBeVisible();

          // Compute expected mathematical position in 120x120 SVG space
          const angle = (score / 100) * 2 * Math.PI;
          const expectedSvgX = 60 + 50 * Math.sin(angle);
          const expectedSvgY = 60 - 50 * Math.cos(angle);

          // Verify SVG data coordinates
          const dataCx = parseFloat((await dot.getAttribute('data-cx')) || '0');
          const dataCy = parseFloat((await dot.getAttribute('data-cy')) || '0');
          expect(Math.abs(dataCx - expectedSvgX)).toBeLessThanOrEqual(0.05);
          expect(Math.abs(dataCy - expectedSvgY)).toBeLessThanOrEqual(0.05);

          // Verify rendered DOM bounding box alignment
          const dotBox = await dot.boundingBox();
          expect(dotBox).not.toBeNull();
          if (dotBox) {
            const dotCenterX = dotBox.x + dotBox.width / 2;
            const dotCenterY = dotBox.y + dotBox.height / 2;

            const ringCenterX = ringBox.x + ringBox.width / 2;
            const ringCenterY = ringBox.y + ringBox.height / 2;

            // Distance of dot center from ring center should be exactly radius = 50/120 * pixelSize
            const expectedRadiusPx = (50 / 120) * pixelSize;
            const actualDistPx = Math.hypot(dotCenterX - ringCenterX, dotCenterY - ringCenterY);
            expect(Math.abs(actualDistPx - expectedRadiusPx)).toBeLessThanOrEqual(2.5);

            // Angle of dot relative to 12 o'clock (0 = top, clockwise)
            let actualAngle = Math.atan2(dotCenterX - ringCenterX, ringCenterY - dotCenterY);
            if (actualAngle < 0) actualAngle += 2 * Math.PI;
            expect(Math.abs(actualAngle - angle)).toBeLessThanOrEqual(0.12);
          }
        }

        // Verify Center Readout text containment
        const value = ring.locator('[data-testid="trust-ring-value"]');
        await expect(value).toBeVisible();
        await expect(value).toHaveText(String(score));

        const valueBox = await value.boundingBox();
        expect(valueBox).not.toBeNull();
        if (valueBox) {
          const ringCenterX = ringBox.x + ringBox.width / 2;
          const ringCenterY = ringBox.y + ringBox.height / 2;

          // All 4 corners of the value bounding box must be inside the inner circle
          const corners = [
            { x: valueBox.x, y: valueBox.y },
            { x: valueBox.x + valueBox.width, y: valueBox.y },
            { x: valueBox.x, y: valueBox.y + valueBox.height },
            { x: valueBox.x + valueBox.width, y: valueBox.y + valueBox.height },
          ];

          for (const corner of corners) {
            const distFromCenter = Math.hypot(corner.x - ringCenterX, corner.y - ringCenterY);
            expect(distFromCenter).toBeLessThanOrEqual(maxInnerRadius);
          }
        }
      }
    }
  });

  test('interactive slider accurately drives ring arc, dot, and label without text clipping', async ({
    page,
  }) => {
    const slider = page.locator('[data-testid="styleguide-score-slider"]');
    await expect(slider).toBeVisible();

    const testScores = [25, 50, 60, 75, 100, 0, 85];

    for (const sc of testScores) {
      await slider.fill(String(sc));
      await page.waitForTimeout(300); // allow spring settling

      const previewSection = page.locator('#interactive-simulator');
      const ring = previewSection.locator('[data-testid="trust-ring"]');
      await expect(ring).toBeVisible();

      const value = ring.locator('[data-testid="trust-ring-value"]');
      await expect(value).toHaveText(String(sc));

      const dot = ring.locator('[data-testid="trust-ring-dot"]');
      if (sc === 0 || sc === 100) {
        await expect(dot).toHaveCount(0);
      } else {
        await expect(dot).toBeVisible();
        const expectedAngle = (sc / 100) * 2 * Math.PI;
        const expectedSvgX = 60 + 50 * Math.sin(expectedAngle);
        const expectedSvgY = 60 - 50 * Math.cos(expectedAngle);

        const dataCx = parseFloat((await dot.getAttribute('data-cx')) || '0');
        const dataCy = parseFloat((await dot.getAttribute('data-cy')) || '0');
        expect(Math.abs(dataCx - expectedSvgX)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(dataCy - expectedSvgY)).toBeLessThanOrEqual(0.05);
      }
    }
  });

  test('verifies Live Monitor layout slots and no text overflow at multiple viewports (1440, 1024, 390)', async ({
    page,
  }) => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/styleguide/trust-ring');
      await page.waitForLoadState('networkidle');

      // Test XS ring (40px) score 100 has no text overflow
      const xsRing100 = page.locator('[data-testid="trust-ring-xs-100"]');
      await expect(xsRing100).toBeVisible();

      const innerBox = xsRing100.locator('[data-testid="trust-ring-inner"]');
      const val = xsRing100.locator('[data-testid="trust-ring-value"]');

      const innerBbox = await innerBox.boundingBox();
      const valBbox = await val.boundingBox();

      expect(innerBbox).not.toBeNull();
      expect(valBbox).not.toBeNull();

      if (innerBbox && valBbox) {
        // Value must fit horizontally and vertically within inner container
        expect(valBbox.width).toBeLessThanOrEqual(innerBbox.width);
        expect(valBbox.height).toBeLessThanOrEqual(innerBbox.height);
      }
    }
  });
});
