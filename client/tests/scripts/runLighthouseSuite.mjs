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
          try {
            const parsed = JSON.parse(body);
            if (parsed.success && parsed.data) {
              resolve(parsed.data);
            } else {
              reject(new Error(`Login failed for ${email}: ${body}`));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON from login: ${body}`));
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
  console.log('      PROCTORIQ COMPREHENSIVE LIGHTHOUSE AUDIT SUITE           ');
  console.log('===============================================================\n');

  console.log('[1/2] Authenticating test accounts for role-gated routes...');
  const student = await login('student2@proctoriq.io', 'ProctorIQ#2026');
  const proctor = await login('proctor@proctoriq.io', 'ProctorIQ#2026');
  const admin = await login('admin@proctoriq.io', 'ProctorIQ#2026');

  const studentAuth = encodeURIComponent(JSON.stringify({ token: student.token, user: student.user }));
  const proctorAuth = encodeURIComponent(JSON.stringify({ token: proctor.token, user: proctor.user }));
  const adminAuth = encodeURIComponent(JSON.stringify({ token: admin.token, user: admin.user }));

  const routes = [
    {
      id: 'landing',
      name: 'Landing Page',
      url: 'http://localhost:5173/',
      outputFile: path.resolve('docs/lighthouse-landing.json'),
    },
    {
      id: 'student-exam',
      name: 'Student Exam Room',
      url: `http://localhost:5173/student/session/1?__auth=${studentAuth}`,
      outputFile: path.resolve('docs/lighthouse-student-exam.json'),
    },
    {
      id: 'proctor',
      name: 'Proctor Live Monitor',
      url: `http://localhost:5173/proctor?__auth=${proctorAuth}`,
      outputFile: path.resolve('docs/lighthouse-proctor.json'),
    },
    {
      id: 'admin',
      name: 'Admin Overview',
      url: `http://localhost:5173/admin?__auth=${adminAuth}`,
      outputFile: path.resolve('docs/lighthouse-admin.json'),
    },
  ];

  const results = [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    console.log(`\n---------------------------------------------------------------`);
    console.log(`[${i + 1}/${routes.length}] Running Lighthouse on ${route.name}`);
    console.log(`URL: ${route.url.slice(0, 50)}...`);
    console.log(`Output: ${route.outputFile}`);
    console.log(`---------------------------------------------------------------`);

    const cmd = `npx lighthouse "${route.url}" --preset=desktop --output=json --output-path="${route.outputFile}" --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices`;

    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.warn(`Lighthouse process warning on ${route.name}:`, err.message);
    }

    if (fs.existsSync(route.outputFile)) {
      const rep = JSON.parse(fs.readFileSync(route.outputFile, 'utf8'));
      const perf = Math.round((rep.categories.performance?.score ?? 0) * 100);
      const a11y = Math.round((rep.categories.accessibility?.score ?? 0) * 100);
      const bp = Math.round((rep.categories['best-practices']?.score ?? 0) * 100);

      const fcp = rep.audits['first-contentful-paint']?.displayValue ?? 'N/A';
      const lcp = rep.audits['largest-contentful-paint']?.displayValue ?? 'N/A';
      const tbt = rep.audits['total-blocking-time']?.displayValue ?? 'N/A';
      const cls = rep.audits['cumulative-layout-shift']?.displayValue ?? 'N/A';

      // Check failing accessibility audits if any
      const flaggedA11y = Object.values(rep.audits).filter(
        (a) => a.score !== null && a.score < 1 && rep.categories.accessibility?.auditRefs?.some((ref) => ref.id === a.id)
      );
      if (flaggedA11y.length > 0) {
        console.log(`⚠️ Flagged a11y issues on ${route.name}:`, flaggedA11y.map((a) => a.id));
      }

      results.push({
        Route: route.name,
        Performance: `${perf} ${perf >= 85 ? '✅' : '⚠️'}`,
        Accessibility: `${a11y} ${a11y >= 95 ? '✅' : '⚠️'}`,
        BestPractices: `${bp} ${bp >= 90 ? '✅' : '⚠️'}`,
        FCP: fcp,
        LCP: lcp,
        TBT: tbt,
        CLS: cls,
      });
    }
  }

  console.log('\n===============================================================');
  console.log('                 FINAL LIGHTHOUSE AUDIT SUMMARY                ');
  console.log('===============================================================');
  console.table(results);
}

main().catch((err) => {
  console.error('Fatal Lighthouse suite error:', err);
  process.exit(1);
});

