import { chromium } from 'playwright';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request(
      'http://localhost:4000/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const parsed = JSON.parse(body);
          if (parsed.success && parsed.data) {
            resolve(parsed.data);
          } else {
            reject(new Error(`Login failed for ${email}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('===============================================================');
  console.log('    PROCTORIQ AUTOMATED LIGHTHOUSE SUITE (AUDIT GATES)         ');
  console.log('===============================================================\n');

  console.log('[1/4] Authenticating role credentials...');
  const student = await login('student2@proctoriq.io', 'ProctorIQ#2026');
  const proctor = await login('proctor@proctoriq.io', 'ProctorIQ#2026');
  const admin = await login('admin@proctoriq.io', 'ProctorIQ#2026');
  console.log(' -> Logged in student, proctor, and admin successfully.');

  const pagesToAudit = [
    {
      name: 'Landing Page',
      url: 'http://localhost:5173/',
      outputFile: 'docs/lighthouse-landing.json',
      auth: null,
      readySelector: 'text=ProctorIQ',
    },
    {
      name: 'Student Exam Kiosk',
      url: 'http://localhost:5173/student/session/1',
      outputFile: 'docs/lighthouse-student-exam.json',
      auth: student,
      readySelector: 'text=Trust Score',
    },
    {
      name: 'Proctor Live Monitor',
      url: 'http://localhost:5173/proctor',
      outputFile: 'docs/lighthouse-proctor.json',
      auth: proctor,
      readySelector: 'text=Proctor Mission Control',
    },
    {
      name: 'Admin Overview Dashboard',
      url: 'http://localhost:5173/admin',
      outputFile: 'docs/lighthouse-admin.json',
      auth: admin,
      readySelector: 'text=Administrator Console',
    },
  ];

  console.log('\n[2/4] Launching Google Chrome on debugging port 9222...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--remote-debugging-port=9222'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const auditResults = [];

  for (const item of pagesToAudit) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`Auditing: ${item.name} (${item.url})`);
    console.log(`---------------------------------------------------------------`);

    // Setup Auth in LocalStorage
    await page.goto('http://localhost:5173/login');
    if (item.auth) {
      await page.evaluate((auth) => {
        localStorage.setItem('proctoriq_auth_v1', JSON.stringify({ token: auth.token, user: auth.user }));
      }, item.auth);
    } else {
      await page.evaluate(() => {
        localStorage.removeItem('proctoriq_auth_v1');
      });
    }

    await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector(item.readySelector, { timeout: 15000 });
    console.log(` -> View ready in browser. Running Lighthouse audit...`);

    const lhCommand = `npx lighthouse ${item.url} --port=9222 --preset=desktop --disable-storage-reset --output=json --output-path=${item.outputFile} --only-categories=performance,accessibility,best-practices --chrome-flags="--headless"`;
    try {
      execSync(lhCommand, { stdio: 'pipe' });
      console.log(` -> Report saved to ${item.outputFile}`);
    } catch (err) {
      console.error(` -> Warning running lighthouse on ${item.name}:`, err.message);
    }

    // Read back and parse JSON
    if (fs.existsSync(item.outputFile)) {
      const report = JSON.parse(fs.readFileSync(item.outputFile, 'utf8'));
      const perf = Math.round((report.categories.performance?.score ?? 0) * 100);
      const a11y = Math.round((report.categories.accessibility?.score ?? 0) * 100);
      const bp = Math.round((report.categories['best-practices']?.score ?? 0) * 100);
      const fcp = report.audits['first-contentful-paint']?.displayValue ?? 'N/A';
      const lcp = report.audits['largest-contentful-paint']?.displayValue ?? 'N/A';
      const tbt = report.audits['total-blocking-time']?.displayValue ?? 'N/A';
      const cls = report.audits['cumulative-layout-shift']?.displayValue ?? 'N/A';

      auditResults.push({
        Route: item.name,
        Performance: `${perf} ${perf >= 85 ? '✅' : '⚠️'} (target >= 85)`,
        Accessibility: `${a11y} ${a11y >= 95 ? '✅' : '⚠️'} (target >= 95)`,
        BestPractices: `${bp} ${bp >= 90 ? '✅' : '⚠️'} (target >= 90)`,
        FCP: fcp,
        LCP: lcp,
        TBT: tbt,
        CLS: cls,
      });
    }
  }

  await browser.close();

  console.log('\n===============================================================');
  console.log('             LIGHTHOUSE AUDIT FINAL RESULTS                    ');
  console.log('===============================================================');
  console.table(auditResults);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

