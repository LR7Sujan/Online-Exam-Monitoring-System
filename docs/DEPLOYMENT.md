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
1. **GitHub Repository**: Push the latest code to `main` (or your deployment branch).
2. **Hosted MySQL 8.0+ Instance**: Provisioned on AWS RDS, PlanetScale, DigitalOcean Managed MySQL, or Aiven.
3. **Pusher Channels Account** (Optional, recommended for lowest latency): Create an app on Pusher to obtain app ID, key, secret, and cluster.
4. **Blob / S3 Storage**: Provision Vercel Blob (`BLOB_READ_WRITE_TOKEN`) or an S3/Cloudflare R2 bucket.

### Step 2.2: Import Project in Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new) and select your Git repository.
2. Configure **Project Settings**:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: `./` (leave at repository root)
   - **Build Command**: `npm run build` (overrides default, compiles server and builds client)
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
| `DB_SSL_CA` | Optional | Server Secret | `-----BEGIN CERTIFICATE-----\n...` | Certificate authority PEM for self-signed or private cloud RDS. |
| `DB_CONNECTION_LIMIT` | Optional | Server Secret | `3` (Default: `3`) | Max pool connections per serverless lambda instance (keep <= 5). |
| `JWT_SECRET` | **Yes** | Server Secret | `[64+_CHAR_RANDOM_STRING]` | Cryptographic secret for signing JWT session tokens. |
| `JWT_EXPIRES_IN` | Optional | Server Secret | `8h` | Token expiration period. |
| `CRON_SECRET` | **Yes** | Server Secret | `[RANDOM_SECRET_HEX]` | Secures `/api/cron/*` endpoints from unauthorized invocation. |
| `REALTIME_PROVIDER` | **Yes** | Server Secret | `pusher` or `polling` | Selects serverless realtime backend (`pusher` recommended). |
| `PUSHER_APP_ID` | Conditional | Server Secret | `1892831` | Required if `REALTIME_PROVIDER="pusher"`. |
| `PUSHER_KEY` | Conditional | Server Secret | `a1b2c3d4e5f6g7h8` | Server Pusher API key. |
| `PUSHER_SECRET` | Conditional | Server Secret | `[PUSHER_SECRET]` | Pusher secret key. |
| `PUSHER_CLUSTER` | Conditional | Server Secret | `mt1` or `ap2` | Pusher region cluster code. |
| `VITE_REALTIME_PROVIDER` | Optional | Client (Public) | `pusher` or `polling` | Realtime provider configured for client SPA. |
| `VITE_PUSHER_KEY` | Conditional | Client (Public) | `a1b2c3d4e5f6g7h8` | Public Pusher key exposed to browser for channel subscription. |
| `VITE_PUSHER_CLUSTER` | Conditional | Client (Public) | `mt1` or `ap2` | Pusher cluster exposed to browser. |
| `STORAGE_PROVIDER` | **Yes** | Server Secret | `blob` or `s3` | Selects object storage backend. (`local` is rejected in production). |
| `BLOB_READ_WRITE_TOKEN` | Conditional | Server Secret | `vercel_blob_rw_...` | Required if `STORAGE_PROVIDER="blob"`. Auto-injected by Vercel Blob store. |
| `S3_BUCKET_NAME` | Conditional | Server Secret | `proctoriq-evidence` | Required if `STORAGE_PROVIDER="s3"`. |
| `S3_REGION` | Conditional | Server Secret | `us-east-1` or `auto` (R2) | Required if `STORAGE_PROVIDER="s3"`. |
| `S3_ACCESS_KEY_ID` | Conditional | Server Secret | `AKIAIOSFODNN7EXAMPLE` | Cloud storage access key ID. |
| `S3_SECRET_ACCESS_KEY` | Conditional | Server Secret | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | Cloud storage secret key. |
| `S3_ENDPOINT` | Optional | Server Secret | `https://<account>.r2.cloudflarestorage.com` | Custom endpoint for Cloudflare R2 or MinIO. |
| `STORAGE_PREFIX` | Optional | Server Secret | `prod/` | Storage prefix key path. |
| `RECORDING_RETENTION_DAYS` | Optional | Server Secret | `30` | Auto-retention days before recordings are purged. |
| `WARNING_GRACE_SECONDS` | Optional | Server Secret | `15` | Anti-cheat warning acknowledgment grace period. |
| `EXTENSION_GRACE_SECONDS`| Optional | Server Secret | `60` | Post-deadline grace period for in-flight submissions. |

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
   aws s3 sync ./server/uploads s3://$S3_BUCKET_NAME/prod/
   ```

---

## 6. Known Limitations & Operational Considerations

### 6.1 Vercel Free (Hobby) Plan Constraints
- **Function Execution Timeout**: Capped at **15 seconds** per request. Long-running tasks (such as monolithic cohort simulations) must run in client-side batches.
- **Payload Request Limit**: Max request body size is **4.5 MB**. Optical evidence snapshots (~150-300 KB JPEG) and recording chunks (~1-2 MB WebM) comfortably fit within this threshold.
- **Cron Frequency**: Hobby accounts support a maximum of **once-per-day** scheduled crons. Timeouts during active exams are therefore enforced lazily upon student and proctor requests (`sp_AutoTimeoutExpiredSessionsWithGrace`), requiring no cron dependency for real-time exam timing.
- **Monthly Execution Limit**: 100,000 invocations per month.
  - Using `REALTIME_PROVIDER="pusher"` consumes ~8 function invocations per examinee-hour (~200 full 1-hour exams/month on free tier).
  - Using `REALTIME_PROVIDER="polling"` consumes ~28 function invocations per examinee-hour (~60 full 1-hour exams/month on free tier).

### 6.2 Cold Starts and Pooling Strategy
- **Cold-Start Duration**: ~60 to 150 ms. Cold starts establish the first MySQL pool connection.
- **Connection Caching**: `getPool()` caches the `mysql2` connection pool across warm lambda invocations via `globalThis`.
- **Connection Limits**: Keep `DB_CONNECTION_LIMIT` between 1 and 3 per serverless instance to prevent exhausting database connection pools when lambdas autoscale.

### 6.3 Realtime Latency: Polling vs. Pusher
- **Pusher Provider**: Near-instant (~120-250 ms) WebSocket event delivery directly between client and Pusher Cloud.
- **Polling Fallback**: Latency equals the client polling interval (2 to 3 seconds). Polling is fully self-contained in MySQL (`Events` table) without external accounts.

### 6.4 Client-Side Proctoring Trust Boundaries
- **Optical Tracking**: MediaPipe face detection, gaze tracking, and tab switch listeners execute in the student's browser context. Advanced attackers can spoof video using virtual camera software (OBS Virtual Camera).
- **Backend Defense-in-Depth**:
  - Optical violations trigger immediate forensic server snapshots stored under tamper-resistant storage keys.
  - The `Proctoring_Logs` table enforces database-level immutability via MySQL triggers (`trg_protect_audit_logs_update` and `trg_protect_audit_logs_delete`).
  - Trust score degradation and auto-disqualification are calculated by database triggers, never by client code.

### 6.5 Recording Storage Growth
- WebM video recordings consume ~25-50 MB per student per exam hour.
- Retention cleanup is managed by `/api/cron/retention` which purges recordings older than `RECORDING_RETENTION_DAYS` (default 30 days) from object storage and updates database status to `PURGED`.
