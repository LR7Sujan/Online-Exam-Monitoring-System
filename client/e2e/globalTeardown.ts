import { rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown(): Promise<void> {
  const rootDir = path.resolve(__dirname, '../../');
  const keepArtifacts = process.env.KEEP_ARTIFACTS === '1';

  // 1. Reset Test Database to pristine seed state
  try {
    console.log('[Playwright Teardown] Resetting exam_monitoring_test to clean fixture state...');
    execSync('npx tsx server/src/scripts/initTestDb.ts --reset', {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DB_NAME: 'exam_monitoring_test',
      },
      stdio: 'pipe',
    });
    console.log('[Playwright Teardown] Test database successfully reset.');
  } catch (err: unknown) {
    console.error('[Playwright Teardown] Warning: failed to reset test DB:', err instanceof Error ? err.message : err);
  }

  // 2. Clean uploads-test directory
  const uploadsTestDir = path.resolve(rootDir, 'server/uploads-test');
  if (existsSync(uploadsTestDir)) {
    try {
      const files = readdirSync(uploadsTestDir);
      for (const file of files) {
        if (file !== '.gitkeep' && file !== 'sample_review.webm') {
          rmSync(path.join(uploadsTestDir, file), { recursive: true, force: true });
        }
      }
      console.log('[Playwright Teardown] Cleaned server/uploads-test directory.');
    } catch (err: unknown) {
      console.warn('[Playwright Teardown] Warning cleaning uploads-test:', err instanceof Error ? err.message : err);
    }
  }

  // 3. Clean test artifacts unless KEEP_ARTIFACTS=1
  if (!keepArtifacts) {
    const artifactDirs = [
      path.resolve(__dirname, '../test-results'),
      path.resolve(__dirname, '../playwright-report'),
    ];
    for (const dir of artifactDirs) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
          console.log(`[Playwright Teardown] Removed ${path.basename(dir)} (KEEP_ARTIFACTS not set).`);
        } catch {
          // Ignore removal errors if files are locked
        }
      }
    }
  } else {
    console.log('[Playwright Teardown] KEEP_ARTIFACTS=1 detected: retaining traces, screenshots, and videos.');
  }
}
