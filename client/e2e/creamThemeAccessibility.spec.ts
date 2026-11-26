import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sujan/.gemini/antigravity/brain/97a5d7ef-e573-4e93-97be-a01e12d76ce9';
const DOCS_DIR = path.resolve(process.cwd(), '../docs/phase23-screenshots');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function disableAnimations(page: any) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition: none !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

async function saveScreenshot(page: any, name: string) {
  ensureDir(DOCS_DIR);
  ensureDir(ARTIFACT_DIR);
  const docsPath = path.join(DOCS_DIR, name);
  const artifactPath = path.join(ARTIFACT_DIR, name);
  await page.screenshot({ path: docsPath, fullPage: false, animations: 'disabled' });
  try {
    fs.copyFileSync(docsPath, artifactPath);
  } catch {}
}

async function setLightCreamTheme(page: any) {
  await page.evaluate(() => {
    localStorage.setItem('proctoriq-theme', 'light');
    window.dispatchEvent(new Event('proctoriq-theme-change'));
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  });
  await disableAnimations(page);
  await page.waitForTimeout(200);
}

async function setDarkTheme(page: any) {
  await page.evaluate(() => {
    localStorage.setItem('proctoriq-theme', 'dark');
    window.dispatchEvent(new Event('proctoriq-theme-change'));
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });
  await disableAnimations(page);
  await page.waitForTimeout(200);
}

// In-browser contrast analyzer script as requested by user
async function runContrastAudit(page: any, pageName: string) {
  return await page.evaluate((name: string) => {
    function parseRgba(colorStr: string) {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1,
      };
    }

    function getLuminance(r: number, g: number, b: number) {
      const a = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }

    function getEffectiveBg(el: HTMLElement): { r: number; g: number; b: number } {
      // Check if el or immediate parent has an active gradient pill
      if (
        (el.tagName === 'BUTTON' && el.querySelector('[class*="bg-gradient"]')) ||
        (el.parentElement?.tagName === 'BUTTON' && el.parentElement.querySelector('[class*="bg-gradient"]'))
      ) {
        return { r: 79, g: 70, b: 229 };
      }
      let curr: HTMLElement | null = el;
      while (curr && curr !== document.documentElement) {
        const style = window.getComputedStyle(curr);
        const bg = style.backgroundColor;
        const bgImg = style.backgroundImage;
        const cls = curr.className || '';
        if ((typeof cls === 'string' && cls.includes('bg-gradient')) || (bgImg && bgImg.includes('gradient'))) {
          // Element itself has a brand gradient background
          return { r: 79, g: 70, b: 229 };
        }
        const parsed = parseRgba(bg);
        if (parsed && parsed.a > 0.3) {
          return { r: parsed.r, g: parsed.g, b: parsed.b };
        }
        curr = curr.parentElement;
      }
      return { r: 244, g: 239, b: 228 }; // #F4EFE4 cream background
    }

    const issues: Array<{ text: string; ratio: number; required: number; tag: string }> = [];
    const elements = document.querySelectorAll<HTMLElement>('p, span, h1, h2, h3, h4, h5, h6, th, td, label, a, button');

    elements.forEach((el) => {
      // Must have direct visible non-empty text
      if (!el.offsetParent && el.tagName !== 'BODY') return;
      const text = el.innerText?.trim();
      if (!text || text.length === 0 || text.length > 80) return;
      if (el.children.length > 3) return; // parent container

      const style = window.getComputedStyle(el);
      const fg = parseRgba(style.color);
      if (!fg || fg.a === 0) return;

      const bg = getEffectiveBg(el);
      const l1 = getLuminance(fg.r, fg.g, fg.b);
      const l2 = getLuminance(bg.r, bg.g, bg.b);
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      const ratio = Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));

      const fontSize = parseFloat(style.fontSize);
      const isBold = parseInt(style.fontWeight, 10) >= 700 || style.fontWeight === 'bold';
      const isLarge = fontSize >= 18 || (isBold && fontSize >= 14);
      const required = isLarge ? 3.0 : 4.5;

      // Allow small decorative / subtle watermarks or icons, but flag real text
      if (ratio < required && !el.getAttribute('aria-hidden') && !el.closest('[aria-hidden="true"]')) {
        issues.push({ text: text.slice(0, 30), ratio, required, tag: el.tagName.toLowerCase() });
      }
    });

    return { pageName: name, totalAudited: elements.length, issueCount: issues.length, issues: issues.slice(0, 10) };
  }, pageName);
}

test.describe('Cream Light Theme & Accessibility Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('proctoriq-theme', 'light');
    });
    await page.route('**odml.pa.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.route('**fonts.googleapis.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );
    await page.route('**fonts.gstatic.com**', (route) =>
      route.fulfill({ status: 200, contentType: 'font/woff2', body: '' })
    );
  });

  test('Login Page: axe-core contrast scan + screenshots at 1440 and 390px', async ({ page }) => {
    // 1440px desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]');
    await setLightCreamTheme(page);

    // Axe scan light
    const axeLight = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeLight.violations).toEqual([]);

    await saveScreenshot(page, 'login-1440.png');

    // Custom contrast audit
    const auditLight = await runContrastAudit(page, 'Login');
    if (auditLight.issueCount > 0) {
      console.log('Custom audit issues on Login:', JSON.stringify(auditLight.issues, null, 2));
    }
    expect(auditLight.issueCount).toBe(0);

    // 390px mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await saveScreenshot(page, 'login-390.png');

    // Dark mode check
    await setDarkTheme(page);
    const axeDark = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeDark.violations).toEqual([]);
  });

  test('Admin Dashboard: axe-core contrast scan + screenshots at 1440 and 390px', async ({ page }) => {
    // Register/login admin
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/admin|\/home/, { timeout: 15000 });
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await setLightCreamTheme(page);

    const axeLight = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeLight.violations).toEqual([]);

    await saveScreenshot(page, 'admin-1440.png');

    // 390px mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await saveScreenshot(page, 'admin-390.png');

    // Dark mode check
    await page.setViewportSize({ width: 1440, height: 900 });
    await setDarkTheme(page);
    const axeDark = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeDark.violations).toEqual([]);
  });

  test('Proctor Dashboard: axe-core contrast scan + screenshots at 1440 and 390px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/proctor|\/home/, { timeout: 15000 });
    await page.goto('/proctor', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid^="student-tile-"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await setLightCreamTheme(page);

    const axeLight = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeLight.violations).toEqual([]);

    await saveScreenshot(page, 'proctor-1440.png');

    // 390px mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await saveScreenshot(page, 'proctor-390.png');

    // Dark mode check
    await page.setViewportSize({ width: 1440, height: 900 });
    await setDarkTheme(page);
    await page.waitForTimeout(500);
    const axeDark = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeDark.violations).toEqual([]);
  });

  test('Student Dashboard: axe-core contrast scan + screenshots at 1440 and 390px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'student@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL(/\/student|\/home/, { timeout: 15000 });
    await page.goto('/student', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await setLightCreamTheme(page);

    const axeLight = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeLight.violations).toEqual([]);

    await saveScreenshot(page, 'student-1440.png');

    // 390px mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await saveScreenshot(page, 'student-390.png');

    // Dark mode check
    await page.setViewportSize({ width: 1440, height: 900 });
    await setDarkTheme(page);
    const axeDark = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeDark.violations).toEqual([]);
  });

  test('Styleguide: axe-core contrast scan + screenshots at 1440 and 390px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/styleguide', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await setLightCreamTheme(page);

    const axeLight = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeLight.violations).toEqual([]);

    await saveScreenshot(page, 'styleguide-1440.png');

    // 390px mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await saveScreenshot(page, 'styleguide-390.png');

    // Dark mode check
    await page.setViewportSize({ width: 1440, height: 900 });
    await setDarkTheme(page);
    const axeDark = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(axeDark.violations).toEqual([]);
  });
});
