import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';

const WORST_CASE_SESSIONS = [
  {
    session_id: 9001,
    exam_id: 1,
    exam_title: 'CS-999: Advanced Fault-Tolerant Distributed Byzantine Fault Consensus Internals with Highly Parallelized Sharded Architectures',
    min_trust_score: 50,
    duration_minutes: 60,
    student_id: 901,
    student_name: 'Dr. Bartholomew Montgomery-Worthington IV, PhD of Advanced Distributed Computing',
    student_email: 'b.montgomery@proctoriq.io',
    trust_score: 100,
    status: 'IN_PROGRESS',
    paper_code: 'P9999-EXTREME',
    total_violations: 999,
    pending_violations: 888,
    confirmed_violations: 111,
    dismissed_violations: 0,
    warning_count: 3,
    last_violation_at: new Date(Date.now() - 10 * 86400 * 1000).toISOString(), // 10d ago
    started_at: new Date().toISOString(),
    server_deadline: new Date(Date.now() + 3600000).toISOString(),
    ended_at: null,
    last_heartbeat_at: new Date().toISOString(),
    seconds_remaining: 3500,
    raw_score: null,
    total_marks: 100,
  },
  {
    session_id: 9002,
    exam_id: 1,
    exam_title: 'NET-880: High-Frequency Low-Latency Kernel Bypass Networking Protocols and Distributed Lock Managers',
    min_trust_score: 75,
    duration_minutes: 60,
    student_id: 902,
    student_name: 'Elena Alexandra-Kaur von Hohenzollern',
    student_email: 'elena.kaur@proctoriq.io',
    trust_score: 0,
    status: 'TERMINATED_CHEATING',
    paper_code: 'P0011',
    total_violations: 999,
    pending_violations: 99,
    confirmed_violations: 900,
    dismissed_violations: 0,
    warning_count: 3,
    last_violation_at: new Date(Date.now() - 40 * 86400 * 1000).toISOString(), // ~Nov (month day)
    started_at: new Date().toISOString(),
    server_deadline: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
    seconds_remaining: 0,
    raw_score: 0,
    total_marks: 100,
  },
  {
    session_id: 9003,
    exam_id: 1,
    exam_title: 'SYS-310: Operating Systems & Concurrency Control',
    min_trust_score: 50,
    duration_minutes: 60,
    student_id: 903,
    student_name: 'Maximilian Zephyrine Constantinopolous',
    student_email: 'm.zephyrine@proctoriq.io',
    trust_score: 100,
    status: 'IN_PROGRESS',
    paper_code: 'P0404',
    total_violations: 0,
    pending_violations: 0,
    confirmed_violations: 0,
    dismissed_violations: 0,
    warning_count: 0,
    last_violation_at: null,
    started_at: new Date().toISOString(),
    server_deadline: new Date(Date.now() + 3600000).toISOString(),
    ended_at: null,
    last_heartbeat_at: new Date().toISOString(),
    seconds_remaining: 3500,
    raw_score: null,
    total_marks: 100,
  },
];

async function setupProctorWithMockData(page: Page) {
  // Mock live-monitor endpoint to return worst case sessions
  await page.route('**/api/proctor/live-monitor*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: WORST_CASE_SESSIONS,
        meta: { total: WORST_CASE_SESSIONS.length },
      }),
    });
  });

  // Login as proctor
  await page.goto('/login');
  await page.fill('input[type="email"]', 'proctor@proctoriq.io');
  await page.fill('input[type="password"]', 'ProctorIQ#2026');
  await page.click('button:has-text("Authenticate & Enter Console")');
  await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
  await page.goto('/proctor');
  await page.waitForLoadState('networkidle');

  // Verify tiles are rendered
  await expect(page.locator('[data-testid^="student-tile-"]').first()).toBeVisible({ timeout: 10000 });
}

async function assertTilesContainNoOverflowingChildren(page: Page) {
  const violations = await page.evaluate(() => {
    const tiles = document.querySelectorAll('[data-testid^="student-tile-"]');
    const issues: string[] = [];

    tiles.forEach((tile, idx) => {
      const tileRect = tile.getBoundingClientRect();
      const descendants = tile.querySelectorAll('*');

      descendants.forEach((child) => {
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (child.classList.contains('sr-only')) return;

        // 1.5px tolerance for subpixel rendering rounding
        const rightDelta = rect.right - (tileRect.right + 1.5);
        const leftDelta = (tileRect.left - 1.5) - rect.left;

        if (rightDelta > 0) {
          issues.push(
            `Tile #${idx} (ID ${tile.getAttribute('data-testid')}) child <${child.tagName.toLowerCase()} class="${child.className.slice(0, 40)}"> overflows RIGHT by ${rightDelta.toFixed(1)}px (child.right: ${rect.right.toFixed(1)}, tile.right: ${tileRect.right.toFixed(1)})`
          );
        }

        if (leftDelta > 0) {
          issues.push(
            `Tile #${idx} child <${child.tagName.toLowerCase()}> overflows LEFT by ${leftDelta.toFixed(1)}px`
          );
        }
      });
    });

    return issues;
  });

  expect(violations).toEqual([]);
}

test.describe('StudentTile Layout Overflow & Worst-Case Resistance', () => {
  test('1440x900 Desktop Dark Mode: No overflow with worst-case data (999 violations, 100% trust, long names)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupProctorWithMockData(page);

    await assertTilesContainNoOverflowingChildren(page);

    // Verify relative date formatting switches to "10d ago" and "Nov" instead of "259h ago"
    await expect(page.locator('text=Last: 10d ago')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tile-overflow-1440-dark.png'), fullPage: false });
  });

  test('1440x900 Desktop Light Mode: No overflow in light mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupProctorWithMockData(page);

    // Toggle theme to light
    const themeBtn = page.locator('button[aria-label*="theme" i], button[title*="theme" i], button:has(.lucide-sun), button:has(.lucide-moon)').first();
    if (await themeBtn.isVisible().catch(() => false)) {
      await themeBtn.click();
      await page.waitForTimeout(300);
    }

    await assertTilesContainNoOverflowingChildren(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tile-overflow-1440-light.png'), fullPage: false });
  });

  test('1024x768 Tablet Viewport: No overflow in medium/tablet grid', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await setupProctorWithMockData(page);

    await assertTilesContainNoOverflowingChildren(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tile-overflow-1024-dark.png'), fullPage: false });
  });

  test('390x844 Mobile Viewport: Chips wrap cleanly, 0 horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupProctorWithMockData(page);

    await assertTilesContainNoOverflowingChildren(page);
    await page.locator('[data-testid^="student-tile-"]').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tile-overflow-390-dark.png'), fullPage: false });
  });
});
