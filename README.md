# ProctorIQ — Autonomous Anti-Cheating & Exam Proctoring Mission Control

A **DBMS-centric**, high-integrity online examination monitoring platform built on **MySQL 8.0+**, **Node.js + Express + Socket.IO + TypeScript**, and **React + Vite + Tailwind CSS + Framer Motion + Recharts**.

All core academic integrity invariants—penalty deductions, dynamic trust score decay, automatic disqualification thresholds, server-synchronized deadlines, atomic answer autosaves, and concurrency-locked grading—are enforced natively inside **MySQL 8.0+ stored procedures and triggers**.

---

## ⚡ Quick Start & Database Setup (Zero Docker Required)

ProctorIQ supports two database setups with zero dependency on Docker:
1. **Option A (Free Hosted Cloud Database):** Any managed MySQL 8.0+ provider (Aiven, AWS RDS / Aurora, GCP Cloud SQL, PlanetScale with InnoDB triggers, or Railway MySQL).
2. **Option B (Local MySQL 8 Service):** A standard local MySQL 8.0+ server installed directly on Windows, macOS (`brew services start mysql`), or Linux (`systemctl start mysql`).

*(Optional: Docker is still supported for local containerization via `npm run db:up` if desired).*

### 1. Configure Database Connection

Create or edit `.env` in the project root:

```env
# Option A: Full Connection String (Cloud / Hosted MySQL with SSL)
DATABASE_URL=mysql://user:password@cloud-host.com:3306/proctoriq?ssl=true
DB_SSL=true

# OR Option B: Standard Parameterized Configuration (Local / Self-Hosted)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=proctoriq_root
DB_NAME=proctoriq
DB_CONNECTION_LIMIT=3
DB_SSL=false
```

### 2. Apply Migrations & Seed Data (Docker-Free Node.js Runner)

Run the automated Node.js migration runner (parses MySQL `DELIMITER` directives, creates tables, triggers, procedures, views, and tracks applied versions in `schema_migrations`):

```bash
# 1. Install dependencies
npm install && npm --prefix server install && npm --prefix client install

# 2. Run pending migrations in alphanumeric order
npm run db:migrate

# 3. Populate default exam and student accounts
npm run db:seed

# 4. Verify hosted database capabilities (ACID locks, triggers & procedures)
npm run db:verify

# 5. Start full-stack development servers
npm run demo
```

---

## 🧪 Isolated Test Database Setup

Automated tests and browser agents are **strictly quarantined** to a dedicated test database whose name must end with `_test`:

1. **Create the test database** on your local or hosted MySQL instance:
   ```sql
   CREATE DATABASE exam_monitoring_test;
   ```
2. **Configure `.env.test`**:
   Ensure `DB_NAME=exam_monitoring_test` in `.env.test` (and `server/.env.test`).
3. **Reset and seed test database**:
   ```bash
   npm --prefix server run db:test:reset
   ```
4. **Strict Safety Guard**:
   All tests and reset commands invoke `assertTestDatabaseSafety()`. If `DB_NAME` does not end with `_test` or `NODE_ENV !== 'test'`, execution is immediately aborted with a safety exception. Production data is never touched.

---

## 📦 Production Data Migration Utility

To copy live data from an existing Docker instance or local database to your hosted database:

```bash
# 1. Dry run (compares table schemas, lists rows, triggers, procedures without writing):
npm run db:migrate:data -- --source-db=proctoriq --target-db=proctoriq_dev --dry-run

# 2. Execute migration with automated row count and trigger parity validation:
npm run db:migrate:data -- --source-db=proctoriq --target-db=proctoriq_dev --execute
```

---

Once running:
- 🌐 **Candidate & Mission Control UI:** [http://localhost:5173](http://localhost:5173)
- 🔌 **Backend REST API & WebSockets:** [http://localhost:4000](http://localhost:4000)
- 📚 **Interactive Swagger API Docs:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- 🤖 **Live Swarm Demo Simulator:** [http://localhost:5173/admin/simulator](http://localhost:5173/admin/simulator)

---

## 🔑 Demo Credentials

All seeded accounts share the default master password: **`ProctorIQ#2026`**

| Role | Email Address | Capabilities |
| :--- | :--- | :--- |
| **Administrator** | `admin@proctoriq.io` | Executive analytics, exam creation wizard, penalty weight tuner, user roles, RFC 4180 CSV & PDF audit exports, swarm simulator. |
| **Proctor** | `proctor@proctoriq.io` | Real-time live monitor grid, streaming violation feed, student telemetry drawer with webcam snapshots, adjudication review queue with trigger-based point restoration. |
| **Student** | `student@proctoriq.io` *(or student2..student60)* | Candidate dashboard, 4-step pre-exam checklist, fullscreen lockdown kiosk, live webcam HUD with face detection, server-synced countdown timer. |

---

## 📸 Core Capabilities & Interface Showcase

```
+-----------------------------------------------------------------------------------+
| PROCTORIQ MISSION CONTROL: ORBITAL PROCTORING CORE                                |
+-----------------------------------------------------------------------------------+
|  [KPI STRIP]  Active Sessions: 30  |  Violations (10m): 12  |  Terminated: 6      |
+-----------------------------------------------------------------------------------+
|  LIVE CANDIDATE TELEMETRY GRID (Framer Motion)    |  REAL-TIME INCIDENT FEED      |
|                                                   |                               |
|  +--------------------+   +--------------------+  |  [CRITICAL] DevTools Detected |
|  | John Doe (CS-401)  |   | Sarah Connor       |  |  Student: Alex Chen (-50 PTS) |
|  | Trust Score: 85%   |   | Trust Score: 50%   |  |  Snapshot: [View JPEG]        |
|  | Status: IN_PROGRESS|   | Status: FLAGGED    |  |  [Confirm]   [Dismiss]        |
|  +--------------------+   +--------------------+  |                               |
|  +--------------------+   +--------------------+  |  [HIGH] Multiple Faces (2+)   |
|  | Alex Chen (CS-401) |   | Virtual Student 5  |  |  Student: Sarah Connor (-35)  |
|  | Trust: 0% [LOCKED] |   | Trust Score: 100%  |  |  Snapshot: [View JPEG]        |
|  | DISQUALIFIED       |   | Status: CLEAN      |  |  [Confirm]   [Dismiss]        |
|  +--------------------+   +--------------------+  |                               |
+-----------------------------------------------------------------------------------+
```

### 1. Student Examination Kiosk (`/student/session/:id`)
- **4-Step Verification Stepper:** Enforces Integrity Rules agreement, optical camera stream initialization, fullscreen kiosk lock, and system telemetry validation.
- **Client-Side Face Detection:** MediaPipe BlazeFace detection running at ~1 frame/second. Flags `NO_FACE` if missing for 5 consecutive seconds; flags `MULTIPLE_FACES` if 2+ faces detected.
- **Persistent TrustRing HUD:** SVG circular gauge that transitions dynamically from emerald $\rightarrow$ amber $\rightarrow$ magenta as score drops, pulsing when critical.
- **Autosave Engine:** Answers synced instantly to MySQL with optimistic UI updates and an offline retry queue.

### 2. Proctor Mission Control (`/proctor`)
- **Socket.IO Real-Time Stream:** Sub-15ms broadcast latency when violations are recorded in MySQL.
- **Interactive Student Drawer:** Detailed Recharts area chart showing trust score trajectory over time with violation markers, student IP / device fingerprint, and webcam snapshots in a lightbox.
- **Adjudication Review Queue:** Table populated from view `vw_ViolationAuditReport`. Clicking "Dismiss" invokes MySQL trigger `trg_after_review_update`, restoring trust points and updating results in real time. Keyboard shortcuts: `C` (Confirm), `D` (Dismiss).

### 3. Administrator Portal (`/admin`)
- **Executive Analytics:** Circadian violation heatmap (hour $\times$ violation type), infraction type distribution donut, time-series incident trends, and trust score distribution histogram.
- **Dynamic Rule Calibration:** Penalty weight editor allowing instant modification of penalties (e.g. changing `TAB_SWITCH` penalty from 15 to 30 PTS). Changes take effect on the very next violation with zero code modifications.
- **Swarm Demo Simulator (`/admin/simulator`):** Spawns $N$ configurable virtual students answering questions and triggering stochastic violations with adjustable chaos and speed sliders.

---

## 🏛️ System Architecture

ProctorIQ enforces a strict separation of concerns where business invariants and state transitions are owned by the database engine:

```
[Candidate Browser]  ──(REST / WebSockets)──>  [Express & Socket.IO Gateway]
                                                         │
                                               (mysql2 Connection Pool)
                                                         ▼
                                            ┌─────────────────────────┐
                                            │ MySQL 8.0+ InnoDB Engine│
                                            │ • Triggers (45000)      │
                                            │ • sp_SubmitAndGradeExam │
                                            │ • SELECT ... FOR UPDATE │
                                            │ • Immutable Audit Logs  │
                                            └─────────────────────────┘
```

For complete architectural details, sequence diagrams, and concurrency locking strategies, consult [Architecture & Design Guide](docs/ARCHITECTURE.md).

---

## 📚 Technical Documentation & Defense Reference

- **[Comprehensive Viva & Defense Guide (docs/VIVA.md)](docs/VIVA.md):** Plain-language model answers to core database and forensic questions (3NF separation, trigger atomicity, `FOR UPDATE` pessimistic row locking, UPSERT mechanics, and 15 additional viva questions).
- **[System Architecture & Forensic Guide (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md):** Full system sequence diagram, session state machine, ACID properties, and MediaPipe face detection specifications.
- **[Entity-Relationship Diagram & Database Schemas (docs/ERD.md)](docs/ERD.md):** 3NF entity-relationship models, tables, indexes, and trigger lifecycles.
- **[REST & Socket.IO API Specification (docs/API_SPEC.md)](docs/API_SPEC.md):** API routes, request/response envelopes, and WebSocket event payloads.

---

## 🔒 Test Environment Isolation & Testing URLs

ProctorIQ enforces strict environment and data isolation to guarantee that the production database (`proctoriq`) contains only real data and is never contaminated by automated or agent testing:

| Environment | Purpose | Database | Client URL | API URL | Uploads Directory |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Real / Dev** | Manual testing & demo simulator | `proctoriq` | `http://localhost:5173` | `http://localhost:4000` | `/server/uploads` |
| **Test / Agent** | Vitest, E2E & Browser Agent | `exam_monitoring_test` | `http://localhost:5174` | `http://localhost:4001` | `/server/uploads-test` |

### Key Isolation Controls:
1. **Safety Guard**: Server startup, seed operations, and test runners (`assertTestDatabaseSafety`) refuse to execute unless `NODE_ENV === 'test'` and `DB_NAME` ends with `_test`.
2. **Browser-Agent Testing**: Browser agents in Antigravity must always interact with `http://localhost:5174` (targeting API on port `4001`).
3. **Automated Teardown**: Global teardown scripts reset the test database to fixture state and remove transient artifacts (`uploads-test`, `test-results`) unless `KEEP_ARTIFACTS=1`.

---

## 🧪 How to Run Tests

ProctorIQ features a multi-tiered automated verification matrix covering database integrity, API security contracts, realtime invariants, Playwright end-to-end browser journeys, and Google Lighthouse production audits.

All test suites can be executed from the monorepo root:

### 1. Database & DBMS Invariants Verification Suite
Verifies all 8 domain tables, referential foreign key cascades, domain CHECK constraints, trigger-level score deductions, anti-tamper locks, `sp_SubmitAndGradeExam` negative marking, and audit log immutability (SQLSTATE 45000):

```bash
# Initialize and seed database
npm run db:init

# Run all 41 database guarantee tests
npm run test:db
```

### 2. Server Unit, Integration, Security & Regression Suites
Executes 144 server tests covering Zod validation, JWT RBAC, OWASP security probes (SQLi, IDOR, XSS, rate limiting), 50-student chaos load simulator, and permanent regression verification:

```bash
# Run Node.js TAP contract & migration parity tests (8 tests)
npm run test:server

# Run Vitest test suites including security probes & bug regressions (136 tests)
npm run test:vitest

# Or run both server suites consecutively:
npm --prefix server test
```

### 3. End-to-End Playwright Browser Journeys
Executes 29 browser tests using headless Chromium with virtual webcam emulation. Tests cover all role user journeys, fullscreen kiosk lock, devtools detection, offline answer queuing, and visual responsive audits:

```bash
# Run all Playwright E2E suites sequentially across all roles
npm run test:e2e

# Or run Playwright with UI inspector
npm --prefix client run test:e2e -- --ui
```

### 4. Google Lighthouse Production Audits
Audits Performance ($\ge 85$), Accessibility ($\ge 95$), and Best Practices ($\ge 90$) across all 4 key views (`/`, `/student/session/1`, `/proctor`, `/admin`):

```bash
# Run headless Lighthouse audit runner against production preview server
node client/tests/scripts/runLighthouseSuite.mjs
```

### 5. Static Code Quality, Typecheck & Production Build
Ensures zero linting warnings, zero TypeScript errors, and verifies tree-shaken production bundles:

```bash
# ESLint across client and server
npm run lint

# TypeScript strict type checking
npm run typecheck

# Full production build (tsc compilation + Vite production bundle)
npm run build
```

---

## 🛡️ Known Limitations & High-Stakes Recommendations

Browser-based proctoring operates within standard web browser security sandbox constraints (HTML5 Fullscreen API, Page Visibility API, and MediaDevices API):

1. **Hardware Capture & Virtual Machines:** Highly sophisticated actors using external HDMI capture cards, secondary monitors through hardware splitters, or hypervisor-level virtual machines cannot be fully detected via client-side JavaScript alone.
2. **Audio Leakage:** Background human voices can be masked or outside directional microphone pickup patterns without multi-channel directional spatial acoustic analysis.
3. **High-Stakes Best Practice:** For high-stakes institutional or certification examinations, ProctorIQ is designed to be paired with:
   - A dedicated OS-level lockdown browser (such as **Safe Exam Browser** or **Chromebook Kiosk Mode**).
   - Dual-camera proctoring (a primary webcam for facial telemetry and a secondary mobile phone camera capturing the candidate's hands, keyboard, and physical desk environment).
