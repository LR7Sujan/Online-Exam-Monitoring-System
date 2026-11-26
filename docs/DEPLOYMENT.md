# ProctorIQ Production Deployment Guide: Serverless Architecture on Vercel

This guide documents the complete procedure for deploying ProctorIQ (Client + Serverless REST API) to Vercel from a single repository without Docker, always-on servers, or local disk dependencies.

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |         Vercel Edge         |
                      |   (CDN, WAF & HTTPS Edge)   |
                      +--------------+--------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
    [Static Assets & SPA]                          [Serverless Functions]
   Vite Client (/client/dist)                      Express App (/api/index.ts)
   • React 18, Tailwind CSS                        • Node.js 22 runtime
   • Client-side detectors                         • Single-domain (/api/*)
   • Aurora Bento UI System                        • Stateless pooled execution
                                                             |
                   +-----------------------------------------+
                   |                     |                   |
                   v                     v                   v
           [Hosted MySQL 8+]     [Realtime Layer]     [Object Storage]
           • PlanetScale / RDS   • Pusher Channels    • Vercel Blob /
           • Aiven / DigitalOcean• Polling (Events)     AWS S3 / CF R2
           • Triggers & SPs
```

---

## 2. Step-by-Step First Deploy to Vercel

### Step 2.1: Prerequisites
1. **GitHub Repository**: Push the latest repository code to `main` (or your deployment branch).
2. **Hosted MySQL 8.0+ Instance**: Provisioned on AWS RDS, PlanetScale, DigitalOcean Managed MySQL, Railway, or Aiven.
3. **Pusher Channels Account** (Optional, recommended for sub-100ms latency): Create a free app on Pusher to obtain app ID, key, secret, and cluster.
4. **Blob / S3 Storage**: Provision Vercel Blob (`BLOB_READ_WRITE_TOKEN`) or an S3/Cloudflare R2 bucket.

### Step 2.2: Import Project in Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new) and select your Git repository.
2. Configure **Project Settings**:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: `./` (leave at repository root)
   - **Build Command**: `npm run build` (compiles server and builds client bundle)
   - **Output Directory**: `client/dist`
   - **Install Command**: `npm install`
3. Expand **Environment Variables** and populate the variables listed in Section 3.
4. Click **Deploy**.

---

## 3. Production Environment Variables Reference

Configure the following environment variables in the Vercel Dashboard under **Project Settings > Environment Variables**:

| Variable Name | Required | Target / Exposure | Example / Format | Purpose |
| :--- | :---: | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Server Secret | `production` | Enables production optimizations and activates security guards. |
| `DATABASE_URL` | Optional | Server Secret | `mysql://user:pass@host:3306/proctoriq?ssl={"rejectUnauthorized":true}` | Full connection URI (overrides individual `DB_*` vars). |
| `DB_HOST` | **Yes** | Server Secret | `db.proctoriq-prod.rds.amazonaws.com` | Database hostname. |
| `DB_PORT` | **Yes** | Server Secret | `3306` | Database TCP port. |
| `DB_USER` | **Yes** | Server Secret | `proctoriq_admin` | Database username. |
| `DB_PASSWORD` | **Yes** | Server Secret | `[STRONG_PASSWORD]` | Database password. |
| `DB_NAME` | **Yes** | Server Secret | `proctoriq` | Production database name (must NOT end with `_test`). |
| `DB_SSL` | **Yes** | Server Secret | `true` or `false` | Enables TLS/SSL database connection. |
| `DB_SSL_CA` | Optional | Server Secret | `-----BEGIN CERTIFICATE-----\n...` | Certificate authority PEM for private cloud RDS. |
| `DB_CONNECTION_LIMIT` | Optional | Server Secret | `3` (Default: `3`) | Max pool connections per serverless instance (keep 1-3). |
| `JWT_SECRET` | **Yes** | Server Secret | `[64+_CHAR_RANDOM_STRING]` | Cryptographic secret for signing JWT session tokens. |
| `JWT_EXPIRES_IN` | Optional | Server Secret | `8h` | Token expiration period. |
| `CRON_SECRET` | **Yes** | Server Secret | `[RANDOM_SECRET_HEX]` | Secures `/api/cron/*` endpoints from unauthorized invocation. |
| `REALTIME_PROVIDER` | **Yes** | Server Secret | `pusher` or `polling` | Selects serverless realtime backend (`pusher` recommended). |
| `PUSHER_APP_ID` | Conditional | Server Secret | `1892831` | Required if `REALTIME_PROVIDER="pusher"`. |
| `PUSHER_KEY` | Conditional | Server Secret | `a1b2c3d4e5f6g7h8` | Server Pusher API key. |
| `PUSHER_SECRET` | Conditional | Server Secret | `[PUSHER_SECRET]` | Pusher secret key. |
| `PUSHER_CLUSTER` | Conditional | Server Secret | `mt1` or `ap2` | Pusher region cluster code. |
| `VITE_API_URL` | Optional | Client (Public) | `/api` | Relative API path for same-origin serverless routing. |
| `VITE_REALTIME_PROVIDER` | Optional | Client (Public) | `pusher` or `polling` | Realtime provider configured for client SPA. |
| `VITE_PUSHER_KEY` | Conditional | Client (Public) | `a1b2c3d4e5f6g7h8` | Public Pusher key exposed to browser for channel subscription. |
| `VITE_PUSHER_CLUSTER` | Conditional | Client (Public) | `mt1` or `ap2` | Pusher cluster exposed to browser. |
| `STORAGE_PROVIDER` | **Yes** | Server Secret | `blob` or `s3` | Selects object storage backend (`local` is blocked in production). |
| `BLOB_READ_WRITE_TOKEN` | Conditional | Server Secret | `vercel_blob_rw_...` | Required if `STORAGE_PROVIDER="blob"`. Auto-injected by Vercel Blob store. |
| `S3_BUCKET` | Conditional | Server Secret | `proctoriq-evidence` | Required if `STORAGE_PROVIDER="s3"`. |
| `S3_REGION` | Conditional | Server Secret | `us-east-1` or `auto` (R2) | Required if `STORAGE_PROVIDER="s3"`. |
| `S3_ACCESS_KEY_ID` | Conditional | Server Secret | `AKIAIOSFODNN7EXAMPLE` | Cloud storage access key ID. |
| `S3_SECRET_ACCESS_KEY` | Conditional | Server Secret | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | Cloud storage secret key. |
| `S3_ENDPOINT` | Optional | Server Secret | `https://<account>.r2.cloudflarestorage.com` | Custom endpoint for Cloudflare R2 or MinIO. |
| `STORAGE_PREFIX` | Optional | Server Secret | `prod/` | Storage prefix key path. |
| `RECORDING_RETENTION_DAYS` | Optional | Server Secret | `30` | Auto-retention days before recordings are purged. |
| `WARNING_GRACE_SECONDS` | Optional | Server Secret | `5` | Anti-cheat warning acknowledgment grace period. |
| `EXTENSION_GRACE_SECONDS`| Optional | Server Secret | `180` | Post-deadline grace period for in-flight submissions. |

---

## 4. Safe Production Database Migration Procedure

All ProctorIQ business logic (scoring invariants, anti-cheating state machine, tamper-proof logs) resides in MySQL stored procedures and triggers. Execute migrations using the idempotent Node.js migration runner:

### Step 4.1: Take a Pre-Migration Backup
Before running migrations on production, always export a full dump:
```bash
mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD \
  --single-transaction --quick --routines --triggers \
  $DB_NAME > "backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"
```

### Step 4.2: Execute Migrations
Run the migration script against the production database:
```bash
# Set production environment variables in your terminal:
export DB_HOST="your-production-db-host.com"
export DB_PORT="3306"
export DB_USER="proctoriq_admin"
export DB_PASSWORD="your-strong-password"
export DB_NAME="proctoriq"
export DB_SSL="true"

# Execute idempotent migration runner
npm run db:migrate
```
*The migration runner logs each applied migration file in the `schema_migrations` table and correctly parses complex MySQL `DELIMITER // ... //` directives for triggers and procedures.*

### Step 4.3: Verify Database Capabilities
Verify that all 17 schema migrations, views, triggers, and stored procedures are active:
```bash
npm run db:verify
```
Ensure that `DB_NAME !== 'exam_monitoring_test'` and `All schema checks passed` is reported.

---

## 5. Data Migration from Docker MySQL Volume to Hosted Cloud Database

To migrate existing candidates, exams, and logs from local Docker to a cloud provider:

1. **Dump Docker Container Database**:
   ```bash
   docker exec -i proctoriq-mysql mysqldump -uroot -pproctoriq_root \
     --single-transaction --routines --triggers proctoriq > proctoriq_docker_export.sql
   ```
2. **Sanitize Docker SQL Dump**:
   Remove any `DEFINER` clauses if your target hosted provider (e.g., AWS RDS or PlanetScale) restricts root definers:
   ```bash
   sed -i -E 's/DEFINER=`root`@`%`//g' proctoriq_docker_export.sql
   sed -i -E 's/DEFINER=`root`@`localhost`//g' proctoriq_docker_export.sql
   ```
3. **Restore into Hosted Cloud MySQL**:
   ```bash
   mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD --ssl-mode=REQUIRED $DB_NAME < proctoriq_docker_export.sql
   ```
4. **Migrate Local Uploads to Object Storage**:
   Upload legacy snapshots and recording chunks from `server/uploads/` to your Vercel Blob or S3 bucket under the `prod/` prefix using the AWS CLI or Vercel Blob CLI:
   ```bash
   aws s3 sync ./server/uploads s3://$S3_BUCKET/prod/
   ```

---

## 6. Cold-Start & Latency Benchmarks (Production-Ready)

| Measurement / Endpoint | p50 Latency | p95 Latency | Operational Details |
| :--- | :---: | :---: | :--- |
| **Serverless Cold-Start** | ~188 ms | ~240 ms | Module initialization + cached connection pool warmup |
| **GET `/api/sessions/:id/time-left`** | **14.91 ms** | **27.56 ms** | Includes atomic lazy enforcement stored procedure check |
| **POST `/api/sessions/:id/violation`** | **14.61 ms** | **26.11 ms** | Deductive scoring triggers + real-time event dispatch |
| **GET `/api/events?since=...` (Polling)**| **18.76 ms** | **27.29 ms** | Lightweight query against indexed `Events` table |
| **Pusher Realtime Delivery** | **~50 ms** | **~70 ms** | 35-45ms REST publish + 15-25ms WebSocket client delivery |

---

## 7. Known Limitations & Operational Considerations

### 7.1 Vercel Free (Hobby) Plan Constraints
- **Function Execution Timeout**: Capped at **15 seconds** per request. Long-running tasks (such as monolithic cohort simulations) run client-side in the browser via timers and `AbortController`.
- **Payload Request Limit**: Max request body size is **4.5 MB**. Optical evidence snapshots (~150-300 KB JPEG) and recording chunks (~1-2 MB WebM) comfortably fit within this threshold.
- **Cron Frequency**: Hobby accounts support a maximum of **once-per-day** scheduled crons (`0 0 * * *`). Active exam timeouts and grace windows are evaluated **lazily on-demand** upon session endpoints (`/time-left`, `/heartbeat`, `/submit`, `/monitor/live`), ensuring exact deadline enforcement even with daily crons!
- **Daily Request Budget (100,000 requests/day)**:
  - **With Pusher**: 1 student generates **6 function invocations/minute** (2 heartbeats + 2 autosaves + 2 time-left syncs; realtime is 0 invocations over WebSocket) &rarr; **360 invocations / 1-hour exam** &rarr; allows **~277 complete 1-hour exams/day** on free tier.
  - **With Polling**: 1 student generates **30 function invocations/minute** (6 student API calls + 24 polling requests every 2.5s) &rarr; **1,800 invocations / 1-hour exam** &rarr; allows **~55 complete 1-hour exams/day** on free tier.

### 7.2 Cold Starts and Pooling Strategy
- **Cold-Start Duration**: ~180 to 240 ms. Warm invocations reuse the cached pool on `globalThis` (<15ms response).
- **Connection Limits**: Keep `DB_CONNECTION_LIMIT` between 1 and 3 per serverless instance to prevent exhausting cloud database connection pools when lambdas autoscale.

### 7.3 Realtime Latency: Polling vs. Pusher
- **Pusher Provider**: Near-instant (~50-70 ms) WebSocket event delivery directly between client and Pusher Cloud.
- **Polling Fallback**: Latency equals the client polling interval (2 to 3 seconds). Polling is fully self-contained in MySQL (`Events` table) without external accounts.

### 7.4 Client-Side Proctoring Trust Boundaries
- **Optical Tracking**: MediaPipe face detection, gaze tracking, and tab switch listeners execute in the student's browser context. Advanced attackers can spoof video using virtual camera software (OBS Virtual Camera).
- **Backend Defense-in-Depth**:
  - Optical violations trigger immediate forensic server snapshots stored under tamper-resistant storage keys.
  - The `Proctoring_Logs` table enforces database-level immutability via MySQL triggers (`trg_protect_audit_logs_update` and `trg_protect_audit_logs_delete`).
  - Trust score degradation and auto-disqualification are calculated by database triggers, never by client code.

### 7.5 Recording Storage Growth
- WebM video recordings consume ~25-50 MB per student per exam hour.
- Retention cleanup is managed by `/api/cron/retention` which purges recordings older than `RECORDING_RETENTION_DAYS` (default 30 days) from object storage and updates database status to `PURGED`.
