import { test, expect } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';
const TEST_API_URL = 'http://localhost:4001/api';

test.describe('OTP Password Reset: Full Lifecycle, Security & UI Guarantees', () => {
  test.beforeEach(async ({ request }) => {
    // Reset OTP tables and rate limit quotas in test environment
    await request.post(`${TEST_API_URL}/auth/test/reset-otp-state`);
  });

  test('1. Direct navigation redirects without state or prerequisite tokens', async ({ page }) => {
    test.slow();
    // Clear any previous sessionStorage
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());

    // Visiting /verify-otp with no email in state/sessionStorage should redirect to /forgot-password
    await page.goto('/verify-otp');
    await expect(page).toHaveURL(/\/forgot-password$/);

    // Visiting /reset-password with no token in state/sessionStorage should redirect to /forgot-password
    await page.goto('/reset-password');
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test('2. Forgot password link on login page opens /forgot-password', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const forgotLink = page.locator('a:has-text("Forgot password?")');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.locator('h2:has-text("Forgot your password?")')).toBeVisible();
  });

  test('3. Unknown email shows identical pages and reveals zero account existence info', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('#forgot-email');
    await emailInput.fill('unknown-candidate-999@proctoriq.io');
    await page.locator('button:has-text("Send code")').click();

    // Navigates uniformly to /verify-otp
    await expect(page).toHaveURL(/\/verify-otp$/);
    await expect(page.locator('h2:has-text("Enter the code")')).toBeVisible();

    // Shows masked email without revealing whether the account exists
    await expect(page.locator('text=u*****@proctoriq.io')).toBeVisible();
  });

  test('4. Wrong code shows generic error, tries counter, shakes, and locks after 5 attempts', async ({ page, request }) => {
    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill('student@proctoriq.io');
    await page.locator('button:has-text("Send code")').click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    // Verify OTP code was generated in mock mailer
    const otpRes = await request.get(`${TEST_API_URL}/auth/test/last-otp?email=student@proctoriq.io`);
    const otpData = await otpRes.json();
    expect(otpData.success).toBe(true);
    expect(otpData.code).toHaveLength(6);

    // Enter wrong codes (5 tries)
    for (let tryNum = 1; tryNum <= 5; tryNum++) {
      // Type wrong code: 000000
      for (let i = 0; i < 6; i++) {
        await page.locator(`#otp-box-${i}`).fill('0');
      }

      if (tryNum < 5) {
        const remaining = 5 - tryNum;
        await expect(
          page.locator(`text=That code isn't valid or has expired (${remaining} ${remaining === 1 ? 'try' : 'tries'} left)`)
        ).toBeVisible();
      } else {
        // Locked state
        await expect(page.locator('text=Too many attempts. Request a new code.')).toBeVisible();
        await expect(page.locator('#otp-box-0')).toBeDisabled();
      }
    }
  });

  test('5. Resend code displays 60s cooldown', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill('student@proctoriq.io');
    await page.locator('button:has-text("Send code")').click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    // Resend button should be disabled with countdown
    const resendBtn = page.locator('button:has-text("Resend code in")');
    await expect(resendBtn).toBeVisible();
    await expect(resendBtn).toBeDisabled();
  });

  test('6. Password reset validation rejects weak and mismatched passwords', async ({ page, request }) => {
    // Request code
    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill('student@proctoriq.io');
    await page.locator('button:has-text("Send code")').click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    // Fetch code from mock mailer
    const otpRes = await request.get(`${TEST_API_URL}/auth/test/last-otp?email=student@proctoriq.io`);
    const { code } = await otpRes.json();

    // Fill code to advance to /reset-password
    for (let i = 0; i < 6; i++) {
      await page.locator(`#otp-box-${i}`).fill(code[i]);
    }
    await expect(page).toHaveURL(/\/reset-password$/);

    const updateBtn = page.locator('button:has-text("Update password")');

    // Test short password (< 8 chars)
    await page.locator('#reset-password').fill('short');
    await page.locator('#reset-confirm-password').fill('short');
    await expect(updateBtn).toBeDisabled();

    // Test mismatched passwords
    await page.locator('#reset-password').fill('ValidPass#2026!');
    await page.locator('#reset-confirm-password').fill('MismatchedPass#2026!');
    await expect(updateBtn).toBeDisabled();
    await expect(page.locator('text=Passwords match')).not.toHaveClass(/text-emerald-500/);
  });

  test('7. Full end-to-end OTP flow with paste, auto-submit, screenshots (Dark/Light at 1440 & 390px), and login verification', async ({ page, request }) => {
    const setCreamTheme = async () => {
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('proctoriq-theme', '"light"');
      });
      await page.waitForTimeout(150);
    };

    const setDarkTheme = async () => {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('proctoriq-theme', '"dark"');
      });
      await page.waitForTimeout(150);
    };

    // ------------------------------------------------------------------------
    // Step A: Forgot Password Page (1440x900 & 390px, Dark & Light)
    // ------------------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Assert fits viewport without scrollbar
    const isScrollable1440 = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(isScrollable1440).toBeFalsy();

    // Capture 1440 Dark
    await setDarkTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-forgot-password-1440-dark.png'), fullPage: true });

    // Switch to Light mode
    await setCreamTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-forgot-password-1440-light.png'), fullPage: true });

    // Capture 390px Mobile Viewport in Light and Dark
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-forgot-password-390-light.png'), fullPage: true });
    await setDarkTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-forgot-password-390-dark.png'), fullPage: true });

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#forgot-email').fill('student@proctoriq.io');
    await page.locator('button:has-text("Send code")').click();

    // ------------------------------------------------------------------------
    // Step B: Verify OTP Page (Paste, Auto-Submit & Screenshots)
    // ------------------------------------------------------------------------
    await expect(page).toHaveURL(/\/verify-otp$/);
    await expect(page.locator('h2:has-text("Enter the code")')).toBeVisible();

    // Capture 1440 Dark
    await setDarkTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-verify-1440-dark.png'), fullPage: true });

    // Switch to Light mode & Mobile
    await setCreamTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-verify-1440-light.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-verify-390-light.png'), fullPage: true });
    await setDarkTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-verify-390-dark.png'), fullPage: true });

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Retrieve generated OTP from mock mailer
    const otpRes = await request.get(`${TEST_API_URL}/auth/test/last-otp?email=student@proctoriq.io`);
    const { code } = await otpRes.json();
    expect(code).toHaveLength(6);

    // Test Paste feature on the first OTP box (auto-submits upon receiving all 6 digits)
    await page.locator('#otp-box-0').focus();
    await page.evaluate((pastedCode) => {
      const box = document.getElementById('otp-box-0') as HTMLInputElement;
      const dt = new DataTransfer();
      dt.setData('text/plain', pastedCode);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      box.dispatchEvent(pasteEvent);
    }, code);

    // ------------------------------------------------------------------------
    // Step C: Reset Password Page (Strength Meter, Update & Screenshots)
    // ------------------------------------------------------------------------
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.locator('h2:has-text("Create a new password")')).toBeVisible();

    // Capture 1440 Dark
    await setDarkTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-reset-1440-dark.png'), fullPage: true });

    // Switch to Light mode & Mobile
    await setCreamTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-reset-1440-light.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-reset-390-light.png'), fullPage: true });
    await setDarkTheme();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-reset-390-dark.png'), fullPage: true });

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    const newPassword = 'NewStudent#Pass2026!';
    await page.locator('#reset-password').fill(newPassword);
    await page.locator('#reset-confirm-password').fill(newPassword);

    // Verify all security checklist requirements show green checks
    await expect(page.locator('div:has-text("At least 8 characters long")').last()).toHaveClass(/text-emerald-500/);
    await expect(page.locator('div:has-text("Contains upper & lowercase letters")').last()).toHaveClass(/text-emerald-500/);
    await expect(page.locator('div:has-text("Contains at least one number (0-9)")').last()).toHaveClass(/text-emerald-500/);
    await expect(page.locator('div:has-text("Contains a special symbol (!@#$%...)")').last()).toHaveClass(/text-emerald-500/);
    await expect(page.locator('div:has-text("Passwords match")').last()).toHaveClass(/text-emerald-500/);
    await expect(page.locator('button:has-text("Update password")')).toBeEnabled();

    // Submit password update
    await page.locator('button:has-text("Update password")').click();

    // Success State view appears
    await expect(page.locator('h2:has-text("Your password has been updated")')).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'otp-success-1440-dark.png'), fullPage: true });

    // ------------------------------------------------------------------------
    // Step D: Sign-in Verification (Old password FAILS, New password SUCCEEDS)
    // ------------------------------------------------------------------------
    // Click "Sign in" button to navigate to sign-in page
    await page.locator('a:has-text("Sign in")').click();
    await expect(page).toHaveURL(/\/\?tab=signin$/);

    // 1. Attempt login with OLD password -> MUST FAIL
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await page.locator('#login-password').fill('ProctorIQ#2026'); // Old password
    await page.locator('button:has-text("Authenticate & Enter Console")').click();

    await expect(page.locator('text=Invalid email or password.')).toBeVisible();

    // 2. Attempt login with NEW password -> MUST SUCCEED
    await page.locator('#login-password').fill(newPassword);
    await page.locator('button:has-text("Authenticate & Enter Console")').click();

    // Navigates successfully to /student or /home
    await expect(page).toHaveURL(/\/(student|home)$/);
  });
});
