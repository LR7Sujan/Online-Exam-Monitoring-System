# Antigravity & Agent Operations Guide: ProctorIQ

## 1. Test Environment Isolation Protocol
All automated tests and Antigravity browser-agent sessions MUST use the dedicated test environment:
- **Test Client URL**: `http://localhost:5174`
- **Test Backend API**: `http://localhost:4001`
- **Test Database**: `exam_monitoring_test`
- **Uploads Directory**: `server/uploads-test`

### Strict Safety Guard
The codebase enforces `assertTestDatabaseSafety()` in `server/src/config/env.ts` and test runners:
- Automated tests or destructive operations are strictly blocked if `NODE_ENV !== 'test'` or `DB_NAME` does not end with `_test`.
- Under no circumstances should test runs target `proctoriq` or ports `4000`/`5173`.

## 2. Browser-Agent Testing Instructions
When invoking browser agents or inspecting UI in Antigravity:
1. Ensure the test backend is running: `npm run start:test` (or Playwright webServer on port 4001).
2. Ensure the test client is running: `npm run dev -- --mode test --port 5174` (or Playwright webServer on port 5174).
3. Direct browser subagents only to `http://localhost:5174`.

## 3. Demo Simulator
- The Demo Simulator operates on the real app (`http://localhost:5173`) by design.
- The simulator marks generated candidate records with the `sim-` or `virtual.candidate.*` prefix.
- The "Reset Simulator" button safely purges simulator data via stored procedures without affecting manual or seed records.
