import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/scoring.test.ts',
      'tests/sqlGuarantees.test.ts',
      'tests/apiSecurity.test.ts',
    ],
    testTimeout: 25000,
  },
});

