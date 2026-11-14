import { test, expect } from '@playwright/test';

interface RouteAudit {
  route: string;
  role: string;
  status: 'PASS' | 'FAIL';
  consoleErrors: string[];
  failedRequests: string[];
  httpErrors: string[];
  totalRequests: number;
}

const auditLog: RouteAudit[] = [];

test.describe('Comprehensive Role-Based Browser & Route Audit', () => {
  test.afterAll(() => {
    console.log('\n========================================================================================');
    console.log(' PROCTORIQ BROWSER CONSOLE & NETWORK AUDIT SUMMARY');
    console.log('========================================================================================');
    console.table(
      auditLog.map((a) => ({
        Role: a.role,
        Route: a.route,
        Status: a.status,
        'Total Req': a.totalRequests,
        'Console Errs': a.consoleErrors.length,
        'Failed Req': a.failedRequests.length,
        '4xx/5xx': a.httpErrors.length,
      }))
    );
    console.log('========================================================================================\n');
  });

  async function auditRoute(
    page: any,
    route: string,
    role: string,
    waitSelector?: string
  ): Promise<RouteAudit> {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const httpErrors: string[] = [];
    let totalRequests = 0;

    const onConsole = (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('MediaStream')) {
          consoleErrors.push(text);
        }
      }
    };

    const onPageError = (err: Error) => {
      consoleErrors.push(`Uncaught Exception: ${err.message}`);
    };

    const onRequestFailed = (req: any) => {
      const errText = req.failure()?.errorText || 'failed';
      // net::ERR_ABORTED occurs naturally when page navigation replaces an in-flight import
      if (!errText.includes('net::ERR_ABORTED')) {
        failedRequests.push(`${req.method()} ${req.url()} - ${errText}`);
      }
    };

    const onResponse = (res: any) => {
      totalRequests++;
      const status = res.status();
      const url = res.url();
      if (status >= 400) {
        httpErrors.push(`${status} ${res.request().method()} ${url}`);
      }
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    try {
      await page.goto(route, { waitUntil: 'networkidle' });
      if (waitSelector) {
        await page.waitForSelector(waitSelector, { timeout: 10000 });
      } else {
        await page.waitForTimeout(1000);
      }
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    }

    const result: RouteAudit = {
      route,
      role,
      status: consoleErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0 ? 'PASS' : 'FAIL',
      consoleErrors,
      failedRequests,
      httpErrors,
      totalRequests,
    };

    auditLog.push(result);

    expect(consoleErrors, `Console errors detected on ${route}: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(failedRequests, `Network request failures on ${route}: ${JSON.stringify(failedRequests)}`).toHaveLength(0);
    expect(httpErrors, `HTTP 4xx/5xx responses on ${route}: ${JSON.stringify(httpErrors)}`).toHaveLength(0);

    return result;
  }

  test('Public routes: /, /login, /register, /styleguide load cleanly', async ({ page }) => {
    await auditRoute(page, '/', 'PUBLIC', 'text=ProctorIQ');
    await auditRoute(page, '/login', 'PUBLIC', 'text=ProctorIQ Access');
    await auditRoute(page, '/register', 'PUBLIC', 'text=Candidate Registration');
    await auditRoute(page, '/styleguide', 'PUBLIC', 'text=Component Styleguide');
  });

  test('STUDENT role routes: /student and /student/results/:id load cleanly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'student@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/student', { timeout: 15000 });

    await auditRoute(page, '/student', 'STUDENT', 'text=Candidate Examination Console');
    await auditRoute(page, '/student/results/13', 'STUDENT', 'text=Official Integrity Rating');
  });

  test('PROCTOR role routes: /proctor, /proctor/audit, /student/results/:id load cleanly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', 'proctor@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/proctor', { timeout: 15000 });

    // 1. Audit /proctor live monitor
    await auditRoute(page, '/proctor', 'PROCTOR', 'text=Proctor Mission Control');

    // 2. Audit /proctor/audit review queue
    await auditRoute(page, '/proctor/audit', 'PROCTOR', 'text=Adjudication Queue');

    // 3. Audit /student/results/13 (Proctor inspecting candidate result)
    await auditRoute(page, '/student/results/13', 'PROCTOR', 'text=Official Integrity Rating');
  });

  test('ADMIN role routes: /admin, /admin/exams, /admin/analytics, /admin/simulator load cleanly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button:has-text("Authenticate & Enter Console")');
    await page.waitForURL('**/admin', { timeout: 15000 });

    // 1. Audit /admin overview
    await auditRoute(page, '/admin', 'ADMIN', 'text=Administrator Console');

    // 2. Audit /admin/exams
    await auditRoute(page, '/admin/exams', 'ADMIN', 'text=Administrator Console');

    // 3. Audit /admin/analytics
    await auditRoute(page, '/admin/analytics', 'ADMIN', 'text=Administrator Console');

    // 4. Audit /admin/simulator
    await auditRoute(page, '/admin/simulator', 'ADMIN', 'text=Candidate Swarm Demo Simulator');
  });
});
