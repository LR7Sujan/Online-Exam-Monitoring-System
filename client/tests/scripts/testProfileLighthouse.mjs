import { chromium } from 'playwright';
import { execSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

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
  console.log('Logging in proctor...');
  const proctor = await login('proctor@proctoriq.io', 'ProctorIQ#2026');

  const profileDir = path.resolve('temp-chrome-proctor');
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }

  console.log('Launching persistent context in:', profileDir);
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: true,
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto('http://localhost:5173/login');
  await page.evaluate((auth) => {
    localStorage.setItem('proctoriq_auth_v1', JSON.stringify({ token: auth.token, user: auth.user }));
  }, proctor);
  await page.goto('http://localhost:5173/proctor');
  await page.waitForSelector('text=Proctor Mission Control', { timeout: 15000 });
  console.log('Proctor page loaded cleanly in profile!');

  await context.close();
  console.log('Browser context closed. Now running Lighthouse with user-data-dir...');

  const escapedProfile = profileDir.replace(/\\/g, '/');
  execSync(
    `npx lighthouse http://localhost:5173/proctor --preset=desktop --disable-storage-reset --chrome-flags="--headless --user-data-dir=${escapedProfile}" --output=json --output-path=docs/lighthouse-proctor.json --only-categories=performance,accessibility,best-practices`,
    { stdio: 'inherit' }
  );

  console.log('Lighthouse run completed!');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
