import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/scoring.test.ts',
      'tests/sqlGuarantees.test.ts',
      'tests/apiSecurity.test.ts',
      'tests/allEndpoints.api.test.ts',
      'tests/securityProbes.test.ts',
      'tests/realtimeAndLoad.test.ts',
      'tests/regressionBugAudit.test.ts',
      'tests/simulatorReset.api.test.ts',
      'tests/examsLifecycle.api.test.ts',
      'tests/timeExtensions.api.test.ts',
      'tests/warningGate.api.test.ts',
      'tests/uniquePaperVersions.api.test.ts',
      'tests/snapshotAccess.api.test.ts',
      'tests/simulatorPersonas.test.ts',
      'tests/recording.api.test.ts',
      'tests/realtimeProviders.test.ts',
      'tests/storageAdapter.test.ts',
      'tests/lazyTimeoutsAndCron.test.ts',
      'tests/dbUnavailableAndHealth.test.ts',
      'tests/otpPasswordReset.integration.test.ts',
      'tests/mailService.test.ts',
      '../client/tests/**/*.unit.test.ts',
    ],
    testTimeout: 45000,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'exam_monitoring_test',
      PORT: '4001',
      CLIENT_ORIGIN: 'http://localhost:5174',
      UPLOADS_DIR: './server/uploads-test',
    },
  },
});

