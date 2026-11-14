import { chromium } from 'playwright';
import { execSync } from 'child_process';
import http from 'http';

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

async function run() {
  console.log('Testing authentication...');
  const student = await login('student2@proctoriq.io', 'ProctorIQ#2026');
  console.log('Logged in student:', student.user.email);

  const proctor = await login('proctor@proctoriq.io', 'ProctorIQ#2026');
  console.log('Logged in proctor:', proctor.user.email);

  const admin = await login('admin@proctoriq.io', 'ProctorIQ#2026');
  console.log('Logged in admin:', admin.user.email);

  console.log('\nLaunching browser with remote debugging port 9222...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--remote-debugging-port=9222'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Test Proctor Monitor
  console.log('\nConfiguring Proctor session on port 9222...');
  await page.goto('http://localhost:5173/login');
  await page.evaluate((auth) => {
    localStorage.setItem('proctoriq_auth_v1', JSON.stringify({ token: auth.token, user: auth.user }));
  }, proctor);
  await page.goto('http://localhost:5173/proctor');
  await page.waitForSelector('text=Proctor Mission Control', { timeout: 15000 });
  console.log('Proctor monitor successfully loaded!');

  console.log('Running Lighthouse via CDP on port 9222...');
  execSync(
    'npx lighthouse http://localhost:5173/proctor --port=9222 --preset=desktop --output=json --output-path=docs/lighthouse-proctor.json --only-categories=performance,accessibility,best-practices',
    { stdio: 'inherit' }
  );

  await browser.close();
  console.log('Done!');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
