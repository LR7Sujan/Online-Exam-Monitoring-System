# ProctorIQ Serverless Migration Audit (Phase 21)

This document provides a comprehensive audit of all components, background processes, local filesystem operations, container dependencies, and in-memory states across the ProctorIQ codebase that must be adapted for deployment to Vercel (unified monorepo: Vite SPA + Serverless API functions) with zero Docker containers, zero always-on servers, and zero local disk writes in production.

---

## 1. Master Audit Table

| File | What It Does | Problem on Serverless (Vercel) | Planned Replacement |
| :--- | :--- | :--- | :--- |
| `db/docker-compose.yml` | Spins up local MySQL 8.0 container with persistent volume and healthcheck | Vercel cannot run Docker containers or host stateful databases | Managed Cloud MySQL (e.g., PlanetScale, AWS RDS / Aurora, GCP Cloud SQL, or Aiven MySQL 8.0) |
| `db/run.sh` | Shell script executing migrations via local `mysql` CLI or `docker exec` | Interactive shell execution via Docker unavailable in CI/CD serverless pipelines | Node-based migration runner (`server/src/scripts/initDb.ts`) run during deployment / CI step |
| `package.json` | Top-level scripts (`db:up`, `db:down`, `dev:server`) relying on Docker | Docker CLI commands fail in serverless build environments | Replace with cloud DB connection strings and unified Vercel dev / build commands |
| `scripts/demo.js` | Script that checks and attempts `docker start proctoriq-mysql` | Docker commands fail in serverless and containerless dev environments | Connect to remote cloud DB or local standalone MySQL service |
| `server/tests/regressionBugAudit.test.ts` | Tests Docker Compose migration mount ordering | Docker Compose volume mounting is irrelevant on cloud databases | Retain test for local Docker sanity; decouple production migrations |
| `server/src/index.ts` | Long-running HTTP server entrypoint (`httpServer.listen`, starts cron daemon) | Serverless functions are stateless, ephemeral request-response handlers without a persistent event loop | Export Express app or individual route handlers for Vercel Serverless Function runtime (`/api/[...route]`) |
| `server/src/realtime/socket.ts` | Stateful Socket.IO server managing persistent WebSocket connections and in-memory rooms | Serverless instances cannot maintain persistent TCP/WebSocket connections across requests or scale across lambdas | Serverless realtime pub/sub service (Pusher Channels, Ably, or AWS API Gateway WebSocket / SSE fallback) |
| `client/src/lib/socket.ts` | Socket.IO client configured with hardcoded `http://localhost:4000` / `4001` | Socket.IO cannot establish WebSocket connections with ephemeral serverless functions | Client adapter switching to managed realtime WebSocket provider (e.g., Pusher / Ably client SDK) |
| `client/src/context/SocketContext.tsx` | React context providing Socket.IO event listeners to frontend | Direct dependency on Socket.IO client instance and reconnection logic | Unified Realtime Context supporting serverless WebSocket provider with identical event interfaces |
| `server/src/app.ts` | Configures `fs.mkdirSync` for `/uploads` and serves static files via `express.static` | Ephemeral serverless filesystem: uploaded files are wiped when the lambda terminates | Pre-signed cloud object storage URLs (AWS S3, Cloudflare R2, or Vercel Blob); no local static serving |
| `server/src/config/env.ts` | Resolves local `UPLOADS_DIR` path with `fs.existsSync` | Production code cannot rely on local directories | Add cloud storage environment variables (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, etc.) |
| `server/src/routes/sessions.routes.ts` | Writes violation snapshots to local disk using `fs.writeFileSync(filePath, buffer)` | Local disk is read-only or ephemeral in Vercel; multiple instances cannot access each other's files | Direct upload or stream buffer to S3 / Cloudflare R2 / Vercel Blob; store public/signed CDN URL |
| `server/src/routes/recordings.routes.ts` | Streams recording video files from local disk via `fs.createReadStream` with range requests | Video files stored locally do not persist across instances; streaming through lambda drains duration limit | Redirect (`302`) to pre-signed S3 / R2 GET URLs with native CDN range-request support |
| `server/src/services/recordingService.ts` | Writes 10s WebM chunks to disk, concatenates files with streams, runs `ffmpeg-static` | Local disk writes fail; ffmpeg binary execution on large files exceeds serverless timeouts (10s-60s) | Upload chunks directly to S3/R2 multi-part; execute concatenation via serverless queue / worker or browser remux |
| `server/src/services/timeoutCron.ts` | `node-cron` running every minute (`* * * * *`) to sweep expired sessions | Long-running background timer dies immediately when serverless invocation ends | Vercel Cron Jobs (`vercel.json` crons invoking protected `/api/cron/timeout-sweep` endpoint) |
| `server/src/services/violationGuard.ts` | In-memory `recentViolations` Map (debounce) and memory-based `express-rate-limit` | State is isolated to individual lambdas; not shared across concurrent instances, causing leakages | Database-backed atomic lock (or distributed Redis / Upstash / DB timestamp checks) |
| `server/src/services/simulator.ts` | In-memory `SimulatorEngine` running `setInterval` loops, maintaining candidate lists & states | Background interval timers are paused/terminated in serverless; state lost between HTTP calls | Move simulation state to DB (`Simulator_Sessions` table) or run tick evaluation client-side / via worker |
| `server/src/config/db.ts` | Creates single MySQL connection pool at startup with `connectionLimit: 10` | Serverless lambdas scale out to hundreds of instances, causing MySQL connection exhaustion | Set `connectionLimit: 1-2`, enable connection pooling / proxy (RDS Proxy / PlanetScale Serverless driver) |
| `server/src/scripts/initDb.ts` | Reads SQL migrations and seed files from local disk using `readFileSync` | Bundled serverless functions do not automatically bundle arbitrary `.sql` files | Include migrations in deployment artifacts or run `db:migrate` as a pre-deploy CI/CD step |
| `server/src/middleware/cors.ts` | Handles CORS origins against `CLIENT_ORIGIN` environment variable | On Vercel monorepo, client and API share the exact same domain, making CORS mostly redundant | Keep for external API calls, but ensure root `/api` functions work under same-origin routing |
| `client/vite.config.ts` | Configures development proxy (`/api`, `/uploads`, `/socket.io` &rarr; `backendTarget`) | Proxy only works in Vite dev server; production Vercel deployment uses Vercel route rewrites | Configure `vercel.json` routing rewrites to route `/api/(.*)` to serverless functions |
| `client/src/lib/api.ts` | Axios client configured with `VITE_API_URL ?? '/api'` | Good for serverless, but defaults to relative `/api` which must resolve to Vercel functions | Maintain relative `/api` base URL; functions seamlessly deploy to `/api` |
| `client/src/components/ui/EvidenceImage.tsx` | Resolves relative `/uploads/...` paths to `backendBase` | Hardcoded backend host assumptions break when files are hosted on Cloud Object Storage | Evidence snapshots reference complete S3/R2/Blob CDN URLs or pre-signed URLs directly |
| `client/src/components/recording/RecordingPlayer.tsx` | Streams `/api/sessions/:id/recording/stream` with JWT query param | Passing large video binary through lambda exhausts bandwidth and execution duration limits | Direct playback from cloud storage signed URL or CDN streaming URL |

---

## 2. Docker & Container Dependencies

### Existing Usage
1. **`db/docker-compose.yml`**:
   - Container name: `proctoriq-mysql`
   - Image: `mysql:8.0`
   - Environment: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
   - Port binding: `3306:3306`
   - Volume: `proctoriq_mysql_data` mapped to `/var/lib/mysql`
   - Auto-mounts migrations:
     - `001_init.sql` &rarr; `/docker-entrypoint-initdb.d/01-init.sql`
     - `002_improvements.sql` &rarr; `/docker-entrypoint-initdb.d/02-improvements.sql`
     - `003_session_security.sql` &rarr; `/docker-entrypoint-initdb.d/03-session-security.sql`
     - `004_snapshot_support.sql` &rarr; `/docker-entrypoint-initdb.d/04-snapshot-support.sql`
     - `005_performance_indexes.sql` &rarr; `/docker-entrypoint-initdb.d/05-performance-indexes.sql`
     - `006_simulator_reset.sql` &rarr; `/docker-entrypoint-initdb.d/06-simulator-reset.sql`
     - `seed.sql` &rarr; `/docker-entrypoint-initdb.d/07-seed.sql`
   - Healthcheck: `mysqladmin ping -h localhost -u root -p${DB_ROOT_PASSWORD}` every 5s.
2. **`db/run.sh`**:
   - Executes arbitrary SQL files using `docker exec -i proctoriq-mysql mysql ...`.
3. **`scripts/demo.js`**:
   - Invokes `docker start proctoriq-mysql` or `docker compose up -d` on demo startup.
4. **`package.json`**:
   - Scripts: `"db:up": "docker compose -f db/docker-compose.yml up -d"` and `"db:down": "docker compose -f db/docker-compose.yml down"`.

### Problem on Serverless
- Vercel is a serverless platform that runs stateless Node.js / Edge functions and hosts static frontend assets. It does **not** provide container runtimes, VM instances, or Docker daemons.
- Local volume mounts (`proctoriq_mysql_data`) and `/docker-entrypoint-initdb.d/` initialization hooks do not exist.

### Planned Replacement
- **Managed MySQL Database**: Use a cloud-hosted MySQL 8.0 instance (AWS RDS, PlanetScale, GCP Cloud SQL, or Aiven MySQL) accessible over public Internet with TLS/SSL encryption.
- **Migration Pipeline**: Execute database migrations via Node.js script (`server/src/scripts/initDb.ts`) during deployment / CI pipeline (e.g. GitHub Actions or pre-build step) rather than on container initialization.
- Retain Docker files solely for optional local development environments.

---

## 3. Realtime & Socket.IO Architecture

### Existing Server-Side Usage (`server/src/realtime/socket.ts`)
- **Initialization**: `initSocketServer(httpServer)` attaches an in-memory `socket.io` instance to the Express HTTP server.
- **Authentication**: Socket handshake JWT authentication reading `socket.handshake.auth.token` or `Authorization` header.
- **In-Memory Rooms**:
  - `role:STUDENT`, `role:PROCTOR`, `role:ADMIN`
  - `user:${studentId}` (individual student isolation)
  - `proctors` (combined proctor and admin group)
  - `session:${sessionId}` (per-exam session monitoring room)
- **Events Emitted by Server**:
  - `violation:new`: Broadcast to `role:PROCTOR` and `role:ADMIN` with telemetry and penalty data.
  - `session:update`: Emitted to proctors and individual student room.
  - `violation:logged`: Emitted to student with updated trust score and penalty.
  - `session:terminated`: Emitted on disqualification / trust score zeroing.
  - `session:submitted` / `exam:submitted`: Emitted on completion or timeout.
  - `log:snapshot_ready`: Emitted when forensic snapshot finishes saving.
  - `extension:requested`: Emitted to proctors when a student requests more time.
  - `extension:decided`: Emitted to student and proctors with approval status.
  - `warning:issued`: Emitted when a formal warning overlay is triggered.
  - `warning:acked`: Emitted when a student acknowledges a warning.
  - `simulator:reset`: Broadcast to all connected clients on simulator reset.
- **Events Listened by Server**:
  - `session:join`: Joins `session:${sessionId}` room (with IDOR check).
  - `session:leave`: Leaves `session:${sessionId}` room.
  - `ping:latency`: Echoes client timestamp for latency calculation.

### Existing Client-Side Usage
- `client/src/lib/socket.ts`: Manages singleton `io(SOCKET_URL, ...)` with automatic reconnection.
- `client/src/context/SocketContext.tsx`: Wraps app, maps socket lifecycle, and updates Zustand stores (`notificationStore`, `proctorStore`, `examStore`).
- `client/src/pages/ProctorDashboardPage.tsx`: Listens to live telemetry stream for live tile updates.
- `client/src/pages/StudentExamPage.tsx`: Listens to penalties, warnings, and termination events.
- `client/src/pages/SimulatorPage.tsx`: Listens to simulator reset and batch telemetry.
- `client/src/components/layout/SidebarStatusCard.tsx`: Displays live WSS connection status and ping latency.

### Problem on Serverless
- Vercel Serverless Functions execute on demand in ephemeral container instances and freeze or terminate as soon as an HTTP response finishes.
- Persistent WebSocket connections cannot be held open by a serverless function.
- Multiple serverless instances running in parallel do not share memory or process state; an event emitted inside one function invocation will not reach clients connected to a different instance.

### Planned Replacement
- **Serverless Pub/Sub Provider**: Transition to a serverless-friendly realtime service such as **Pusher Channels** or **Ably** (or Server-Sent Events / HTTP polling as a fallback):
  - When a serverless function processes an event (e.g. `POST /api/violations`), it triggers an event over HTTP REST to the realtime service (`pusher.trigger('proctors', 'violation:new', payload)`).
  - The client maintains a WebSocket connection directly to the managed realtime provider, receiving events with sub-50ms latency.
  - Rooms map cleanly to Pusher private channels (`private-user-${studentId}`, `private-session-${sessionId}`, `private-proctors`).
  - Strict auth endpoint (`POST /api/pusher/auth`) validates JWT and authorizes channel access.

---

## 4. Local Filesystem (`fs`) Usage & Uploads

### Existing Usages
1. **`server/src/app.ts`**:
   - `serverUploadsDir = env.UPLOADS_DIR ...; fs.mkdirSync(serverUploadsDir, { recursive: true });`
   - Static file route `app.use('/uploads', ...)` with HMAC URL verification and token-based RBAC checks.
2. **`server/src/routes/sessions.routes.ts`**:
   - Extracts base64 JPEG from violation report, generates filename `snapshot-${sessionId}-${timestamp}-${rand}.jpg`.
   - Writes directly to disk: `fs.writeFileSync(filePath, buffer)`.
3. **`server/src/routes/recordings.routes.ts`**:
   - Streams WebM video directly from disk using `fs.createReadStream(filePath, { start, end })`.
   - Checks file existence with `fs.existsSync(filePath)` and stat sizing with `fs.statSync(filePath)`.
4. **`server/src/services/recordingService.ts`**:
   - Chunks directory created via `fs.mkdirSync(chunksDir, { recursive: true })`.
   - Chunk upload saved via `await fs.promises.writeFile(chunkPath, buffer)`.
   - Concatenates chunks using `fs.createWriteStream(rawConcatenatedPath)`.
   - Remuxes WebM using spawned `ffmpeg-static` process reading and writing to disk.
   - Deletes temporary raw files and chunks with `fs.promises.unlink`.
   - Nightly retention cleanup unlinks expired video files from local disk.
5. **`server/src/services/simulator.ts`**:
   - Generates simulated violation snapshot files on disk using `fs.writeFileSync(filePath, tinyJpeg)`.
   - Cleans up simulator files using `fs.unlinkSync(...)`.

### Problem on Serverless
- Vercel Serverless Functions have a read-only filesystem, except for an ephemeral `/tmp` directory (limited to 512 MB to 10 GB depending on tier).
- Any files written to `/tmp` are wiped as soon as the lambda container shuts down or recycles.
- Files written in one lambda instance are **invisible** to other concurrent lambdas, so another serverless function serving `GET /uploads/...` or `GET /api/sessions/:id/recording/stream` will return `404 Not Found`.

### Planned Replacement
- **Cloud Object Storage (S3-Compatible)**:
  - Use AWS S3, Cloudflare R2, or Vercel Blob.
  - **Forensic Snapshots**: Serverless function uploads image buffers directly to S3/R2 with standard keys (`snapshots/{examId}/{sessionId}/{filename}.jpg`) and saves the object storage URL in `Proctoring_Logs.snapshot_url`.
  - **Secure Access**: Replace custom local static file route with pre-signed S3/R2 GET URLs (5-minute expiration) generated by `snapshotSigner.ts`.
  - **Recordings**: Store video chunks and finalized WebMs in object storage. `GET /api/sessions/:id/recording/stream` returns a `302 Redirect` to a pre-signed S3/R2 streaming URL, allowing cloud CDN to handle range requests and video scrubbing without hitting serverless bandwidth limits.

---

## 5. Background Schedulers & Timers

### Existing Usages
1. **`server/src/services/timeoutCron.ts`**:
   - Uses `node-cron` scheduled to run every minute: `cron.schedule('* * * * *', () => runAutoTimeoutSweep())`.
   - Queries `Exam_Sessions` and executes `CALL sp_AutoTimeoutExpiredSessionsWithGrace(?)`.
   - Started in `server/src/index.ts` during server startup.
2. **`server/src/routes/recordings.routes.ts`**:
   - Has `cleanupExpiredRecordings()` function intended for scheduled execution to delete recordings older than `RECORDING_RETENTION_DAYS`.
3. **`server/src/services/simulator.ts`**:
   - `SimulatorEngine` creates `this.timer = setInterval(..., 1000 / speed)`.
   - Schedules student action delays using `setTimeout(...)`.
4. **`scripts/simulate.ts`**:
   - CLI script uses `setInterval` to render status tables to terminal.

### Problem on Serverless
- Node.js background timers (`node-cron`, `setInterval`, `setTimeout`) require a continuous, long-running Node process.
- In serverless, functions are frozen between requests and destroyed when idle. Crons scheduled in memory will never trigger.

### Planned Replacement
- **Vercel Cron Jobs**:
  - Configure scheduled jobs in `vercel.json`:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/timeout-sweep",
          "schedule": "* * * * *"
        },
        {
          "path": "/api/cron/recording-retention",
          "schedule": "0 2 * * *"
        }
      ]
    }
    ```
  - Create secure API endpoints (`/api/cron/timeout-sweep` and `/api/cron/recording-retention`) guarded by a `CRON_SECRET` authorization header (`Bearer ${CRON_SECRET}`).
  - When invoked by Vercel's infrastructure, the handler executes `runAutoTimeoutSweep()` and `cleanupExpiredRecordings()` within a standard serverless request lifecycle.

---

## 6. In-Memory Server State & Statelessness

### Existing Usages
1. **`server/src/services/violationGuard.ts`**:
   - `const recentViolations = new Map<string, number>()`: Debounces duplicate violations within 3 seconds (`${sessionId}:${code}`).
   - `violationRateLimiter = rateLimit({ windowMs: 60000, max: 30 })`: Uses default in-memory `MemoryStore`.
2. **`server/src/services/simulator.ts`**:
   - `private state: SimulatorState`: Stores current simulation status (`isRunning`, `isPaused`, `speed`, `candidates`, `stats`, `activityLogs`) in a class instance variable.
   - `private candidates: SimCandidate[]`: In-memory array of candidate state machines.
3. **`server/src/services/snapshotSigner.ts`**:
   - In-memory HMAC signature verification (this is stateless crypto, which works fine on serverless).

### Problem on Serverless
- Serverless functions are stateless and horizontally scaled across multiple instances.
- In-memory Maps (`recentViolations`) and in-memory rate limiters exist only within a single lambda instance. A student sending rapid violations will hit different lambdas, bypassing debounce windows and rate limits.
- The simulator cannot be started via `POST /api/simulator/start` and inspected via `GET /api/simulator/state` if consecutive HTTP calls route to different serverless instances.

### Planned Replacement
- **Debouncing & Rate Limiting**:
  - Migrate violation debounce checks to SQL using the existing `Proctoring_Logs` table (querying `MAX(created_at) WHERE session_id = ? AND violation_type_id = ?`) or use a serverless key-value store (Upstash Redis / Vercel KV) with atomic `SET key val EX 3 NX`.
  - Migrate rate limiting to Upstash Redis (`@upstash/ratelimit`) or a lightweight DB token-bucket table.
- **Simulator State**:
  - Store simulation metadata and active candidate status in a dedicated database table (e.g., `Simulator_Runs` and `Simulator_Candidates`) or drive simulation ticks deterministically from the client / administrative test runner.

---

## 7. Long-Running Work & Execution Limits

### Existing Usages
1. **Recording Concatenation & Remuxing (`recordingService.ts`)**:
   - `finishRecording`: Loops over WebM chunks on disk, writes concatenated file stream, then spawns `ffmpeg` (`ffmpegStatic`) to remux and calculate EBML duration.
   - For an exam of 1–3 hours with hundreds of 10-second chunks, concatenation and ffmpeg processing can take 30 to 120 seconds.
2. **Simulator Execution Loop (`simulator.ts`)**:
   - Simulates 10–50 students answering questions and triggering violations over minutes or hours.
3. **Data Exports (`studentAuditService.ts`, `exams.routes.ts`)**:
   - `GET /api/students?format=csv`: Streams student directory CSV.
   - `GET /api/admin/exams/:id/results/export?format=csv`: Streams exam candidate results CSV.
   - Currently lightweight (<500ms for typical batches), but large datasets could approach limits.
4. **Database Migration & Seeding (`initDb.ts`, `initTestDb.ts`)**:
   - Applies 6 migration SQL scripts and seeds hundreds of records; takes 2–5 seconds.

### Problem on Serverless
- Vercel execution timeouts:
  - **Hobby Plan**: Maximum 10 seconds execution limit.
  - **Pro / Enterprise Plan**: Configurable up to 60 seconds (or 300 seconds on Edge/Background Functions).
- Any request that exceeds the timeout is abruptly killed with an HTTP `504 Gateway Timeout`.
- Spawning child processes like `ffmpeg-static` in serverless lambdas is fragile due to strict binary architecture constraints (AWS Lambda Linux x86_64/ARM64 vs local OS binaries) and memory limits.

### Planned Replacement
- **Client-Side or Background Concatenation**:
  - Upload chunks directly to Cloudflare R2 / S3 via multi-part upload or keep chunk manifest in database, allowing client `RecordingPlayer` to play consecutive chunks via MediaSource Extensions (MSE) or HLS.
  - Alternatively, offload heavy media processing to a dedicated asynchronous background worker (e.g., AWS Lambda with higher timeout or Cloudflare Worker).
- **Simulator Architecture**:
  - Refactor simulation into discrete, single-tick API calls (`POST /api/simulator/tick`) triggered by the client, or execute via external standalone script (`npm run simulate`) during demos.
- **Data Streaming**:
  - Ensure CSV endpoints stream rows with efficient indexed SQL queries, well within 2 seconds.

---

## 8. Request Payload Size Limits

### Existing Usages
- **`server/src/app.ts`**:
  - `app.use(express.json({ limit: '10mb' }));`
  - `app.use(express.urlencoded({ extended: true, limit: '10mb' }));`
- **`server/src/routes/sessions.routes.ts`**:
  - Snapshot base64 upload enforces a 2 MB limit per image:
    `if (buffer.length > 2 * 1024 * 1024) throw new AppError(413, 'SNAPSHOT_TOO_LARGE', ...)`
- **`server/src/services/recordingService.ts`**:
  - Chunk upload endpoint enforces a 25 MB limit:
    `if (buffer.length > 25 * 1024 * 1024) throw new AppError(413, 'CHUNK_TOO_LARGE', ...)`

### Problem on Serverless
- **Vercel Request Body Limit**: Vercel Serverless Functions enforce a strict **4.5 MB request body limit**.
- Any HTTP request with a body larger than 4.5 MB sent to a Vercel Serverless Function fails at the edge with HTTP `413 Payload Too Large` before ever reaching application code.
- While snapshot uploads (typically 100 KB – 500 KB) fit under 4.5 MB, recording chunks (currently configured up to 25 MB) will fail if client bandwidth hiccups cause multiple chunks or larger slices to be sent.

### Planned Replacement
- **Client Direct-to-Storage Uploads**:
  - Implement pre-signed upload URLs:
    1. Client calls `POST /api/sessions/:id/recording/upload-url` (returns pre-signed S3/R2 PUT URL).
    2. Client uploads chunk directly to S3/R2 via HTTP PUT (bypassing Vercel proxy entirely, zero payload size bottleneck).
    3. Client notifies backend `POST /api/sessions/:id/recording/chunks/ack` with chunk metadata.
- **Client Chunk Sizing**:
  - Enforce strict 10s timeslice on client `MediaRecorder` at 250 kbps (~300 KB per chunk) so any fallback proxy payload remains well below 2 MB.

---

## 9. Database Connection, SSL, Timezone, MultipleStatements & Migrations

### Existing Setup (`server/src/config/db.ts` & `initDb.ts`)
- **Connection Pool**:
  - `mysql.createPool({ host, port, user, password, database, connectionLimit: 10, timezone: 'Z', multipleStatements: false })`
  - Created once at module load time.
- **SSL / TLS**:
  - No `ssl` options configured (assumes unencrypted local Docker MySQL connection).
- **Timezone**:
  - Configured with `timezone: 'Z'` (UTC), matching UTC date handling.
- **Multiple Statements**:
  - `multipleStatements: false` on application pool for SQL injection prevention.
- **Migrations & DELIMITER Blocks**:
  - `initDb.ts` uses custom `parseSqlScript(sqlText)` to parse custom `DELIMITER //` directives used by MySQL triggers (`trg_CheckTrustScore`, `trg_ProtectImmutableLogs`) and stored procedures (`sp_DeductTrustPenalty`, `sp_AutoTimeoutExpiredSessionsWithGrace`, `sp_ResetSimulatorData`).

### Problem on Serverless
1. **Connection Exhaustion**:
   - In a traditional server, a single pool holds up to 10 connections. In serverless, 100 concurrent lambda instances will each instantiate their own connection pool, creating up to 1,000 simultaneous connections and crashing MySQL (`Too many connections`).
2. **Missing SSL**:
   - Cloud databases (AWS RDS, PlanetScale, Aiven, GCP Cloud SQL) require TLS/SSL encryption. Connecting without SSL will be rejected.
3. **Migration Execution**:
   - Vercel functions cannot easily run multi-file migrations at runtime because `.sql` files in `db/migrations/` are not bundled into serverless function output by default.

### Planned Replacement
1. **Serverless Connection Management**:
   - Configure connection pool with `connectionLimit: 1` or `2` for serverless environments.
   - Cache the pool instance globally (`globalThis.__dbPool`) across warm lambda container reuses.
   - Support AWS RDS Proxy, PlanetScale serverless driver, or cloud connection poolers.
2. **SSL Configuration**:
   - Add conditional SSL support in `server/src/config/db.ts`:
     ```typescript
     ssl: env.DB_SSL ? { rejectUnauthorized: true, ca: env.DB_CA_CERT } : undefined
     ```
3. **Automated Migration Runner**:
   - Run database migrations as a pre-deploy build command (`npm run db:migrate`) or in CI/CD pipeline prior to deploying frontend and API.

---

## 10. CORS, Client URLs, and Vite Proxy

### Existing Setup
- **`server/src/middleware/cors.ts`**:
  - Dynamic CORS middleware checking `req.headers.origin` against `env.CLIENT_ORIGIN` (split by comma).
  - Defaults to `http://localhost:5173,http://localhost:5174`.
- **`client/vite.config.ts`**:
  - Local development proxy routing `/api`, `/uploads`, and `/socket.io` to `http://localhost:4000` (or `4001` in test mode).
- **`client/src/lib/api.ts`**:
  - `API_BASE = import.meta.env.VITE_API_URL ?? '/api'`.
  - Axios client sends relative requests to `/api/*`.
- **`client/src/lib/socket.ts`**:
  - `SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'`.
- **`client/src/components/ui/EvidenceImage.tsx`**:
  - Inspects `src`; if relative, prepends `VITE_BACKEND_ORIGIN`.

### Problem on Serverless
- In local development, the client and server run on different ports (`5173` vs `4000`), necessitating Vite dev proxy and CORS headers.
- On Vercel, the entire project is deployed as a single origin:
  - Static Vite build served from root (`/`).
  - Serverless functions served under `/api/*`.
- Hardcoded URLs pointing to `http://localhost:4000` break in production.

### Planned Replacement
- **Single-Origin Deployment via `vercel.json`**:
  - In production, client makes same-origin requests directly to `/api/*`. No CORS preflight requests or cross-origin headers required for client-to-API communication.
  - Configure `vercel.json` routing:
    ```json
    {
      "rewrites": [
        { "source": "/api/(.*)", "destination": "/api" },
        { "source": "/(.*)", "destination": "/index.html" }
      ]
    }
    ```
- **Unified Client URLs**:
  - Default `VITE_API_URL` to `/api` across all environments.
  - Replace `SOCKET_URL` with managed realtime credentials (`VITE_PUSHER_KEY`, `VITE_PUSHER_CLUSTER`).
  - In `EvidenceImage.tsx`, ensure snapshot URLs stored as complete HTTPS CDN links render directly without host concatenation.

---

## 11. Summary of Migration Steps

1. **Database**: Provide managed MySQL 8.0 connection string with SSL; add connection limit controls for serverless lambdas.
2. **Object Storage**: Implement S3/R2 storage adapter for evidence snapshots and recording chunks; replace `/uploads` static serving with signed URLs.
3. **Serverless Realtime**: Implement serverless pub/sub adapter (Pusher / Ably) for live monitor telemetry, warnings, and notifications.
4. **Scheduled Crons**: Move auto-timeout sweeps and retention cleanup to Vercel Cron endpoints with secret authorization.
5. **Stateless Logic**: Migrate in-memory rate limiting and violation debounce tracking to database/atomic store.
6. **Unified Vercel Packaging**: Configure monorepo `vercel.json`, build scripts, and serverless function entrypoint (`api/index.ts`).
