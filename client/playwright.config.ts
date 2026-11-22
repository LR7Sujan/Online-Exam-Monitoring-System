import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: process.env.TEST_DIR || './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalTeardown: path.resolve(__dirname, './e2e/globalTeardown.ts'),
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  webServer: [
    {
      command: 'npm --prefix ../server run start:test',
      url: 'http://localhost:4001/api/health',
      reuseExistingServer: true,
      timeout: 30000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --mode test --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: 30000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});

