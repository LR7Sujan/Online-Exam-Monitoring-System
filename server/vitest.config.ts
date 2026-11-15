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
    ],
    testTimeout: 25000,
    fileParallelism: false,
  },
});

