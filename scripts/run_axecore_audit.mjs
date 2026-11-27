import { chromium } from '../client/node_modules/@playwright/test/index.mjs';
import AxeBuilder from '../client/node_modules/@axe-core/playwright/dist/index.mjs';

const BASE_URL = 'http://localhost:5174';
const ACCENTS = ['indigo', 'cyan', 'emerald', 'amber', 'rose'];
const THEMES = ['dark', 'light'];

const PAGES_TO_TEST = [
  { name: 'login', path: '/', role: 'ANON' },
  { name: 'home', path: '/home', role: 'ADMIN' },
  { name: 'live-monitor', path: '/proctor', role: 'PROCTOR' },
  { name: 'student-audit', path: '/admin/students', role: 'ADMIN' },
  { name: 'exam-catalog', path: '/admin/exams', role: 'ADMIN' },
  { name: 'analytics-heatmap', path: '/admin/analytics', role: 'ADMIN' },
  { name: 'simulator', path: '/admin/simulator', role: 'ADMIN' },
  { name: 'student-dashboard', path: '/student', role: 'STUDENT' },
  { name: 'styleguide-tokens', path: '/styleguide/tokens', role: 'ADMIN' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Mock API endpoints
  await page.route('**/api/notifications**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [], unreadCount: 0 }) });
  });
  await page.route('**/api/monitor/stats**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ liveCount: 0, flagCount: 0 }) });
  });
  await page.route('**/api/events**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
  });
  await page.route('**/api/exams**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exams: [] }) });
  });
  await page.route('**/api/sessions**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: [] }) });
  });
  await page.route('**/api/audit/students**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ students: [] }) });
  });

  const results = [];

  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      console.log(`\nScanning theme=${theme}, accent=${accent}...`);

      for (const p of PAGES_TO_TEST) {
        // Set user session
        if (p.role !== 'ANON') {
          const user = {
            id: 1,
            email: `${p.role.toLowerCase()}@proctoriq.io`,
            fullName: `Test ${p.role}`,
            role: p.role,
          };
          await page.goto(`${BASE_URL}/`);
          await page.evaluate(({ u, t, a }) => {
            localStorage.setItem('proctoriq_auth_v1', JSON.stringify({ token: 'fake-jwt', user: u }));
            localStorage.setItem('proctoriq-theme', t);
            localStorage.setItem('proctoriq-accent', a);
            document.documentElement.setAttribute('data-accent', a);
            if (t === 'dark') {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
            } else {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
            }
          }, { u: user, t: theme, a: accent });
        } else {
          await page.goto(`${BASE_URL}/`);
          await page.evaluate(({ t, a }) => {
            localStorage.clear();
            localStorage.setItem('proctoriq-theme', t);
            localStorage.setItem('proctoriq-accent', a);
            document.documentElement.setAttribute('data-accent', a);
            if (t === 'dark') {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
            } else {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
            }
          }, { t: theme, a: accent });
        }

        await page.goto(`${BASE_URL}${p.path}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(300);

        try {
          const axe = new AxeBuilder({ page }).withRules(['color-contrast']);
          const scan = await axe.analyze();
          if (scan.violations.length > 0) {
            console.log(`  ❌ [${p.name} - ${theme} - ${accent}] ${scan.violations.length} violations:`);
            for (const v of scan.violations) {
              for (const node of v.nodes) {
                console.log(`     - Target: ${node.target.join(' ')}`);
                console.log(`       Failure: ${node.failureSummary}`);
                results.push({
                  page: p.name,
                  theme,
                  accent,
                  target: node.target.join(' '),
                  summary: node.failureSummary,
                });
              }
            }
          } else {
            console.log(`  ✅ [${p.name} - ${theme} - ${accent}] 0 contrast violations`);
          }
        } catch (err) {
          console.error(`  ⚠️ Axe scan failed on ${p.name}:`, err.message);
        }
      }
    }
  }

  await browser.close();
  console.log(`\nScan complete. Total violations found: ${results.length}`);
}

main().catch(console.error);
