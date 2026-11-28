import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.VITEST) ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.argv.some((arg) => arg.includes('vitest') || arg.includes('test'));

if (isTestEnv && process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

// Resolve .env candidate paths relative to script location / project root
const candidateEnvPaths = isTestEnv
  ? [
      process.env.ENV_FILE,
      process.env.DOTENV_CONFIG_PATH,
      path.resolve(__dirname, '../../.env.test'),
      path.resolve(__dirname, '../../../.env.test'),
    ].filter(Boolean) as string[]
  : [
      process.env.ENV_FILE,
      process.env.DOTENV_CONFIG_PATH,
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env'),
    ].filter(Boolean) as string[];

for (const envPath of candidateEnvPaths) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    break;
  }
}

// Parse DATABASE_URL if provided to pre-populate DB_* environment variables
if (process.env.DATABASE_URL) {
  try {
    const parsedUrl = new URL(process.env.DATABASE_URL);
    if (!process.env.DB_HOST && parsedUrl.hostname) {
      process.env.DB_HOST = parsedUrl.hostname;
    }
    if (!process.env.DB_PORT && parsedUrl.port) {
      process.env.DB_PORT = parsedUrl.port;
    }
    if (!process.env.DB_USER && parsedUrl.username) {
      process.env.DB_USER = decodeURIComponent(parsedUrl.username);
    }
    if (!process.env.DB_PASSWORD && parsedUrl.password) {
      process.env.DB_PASSWORD = decodeURIComponent(parsedUrl.password);
    }
    if (!process.env.DB_NAME && parsedUrl.pathname) {
      const db = parsedUrl.pathname.replace(/^\//, '');
      if (db) process.env.DB_NAME = db;
    }
    const sslParam = parsedUrl.searchParams.get('ssl');
    if (process.env.DB_SSL === undefined && sslParam) {
      const lower = sslParam.toLowerCase();
      process.env.DB_SSL = lower === 'true' || lower === '1' || lower.includes('rejectunauthorized') ? 'true' : 'false';
    }
  } catch (err) {
    console.warn('[Env] Failed to parse DATABASE_URL:', err);
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default(isTestEnv ? 'test' : 'development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(isTestEnv ? 4001 : 4000),
  CLIENT_ORIGIN: z.string().default(isTestEnv ? 'http://localhost:5174' : 'http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default('proctoriq_root'),
  DB_NAME: z.string().min(1).default(isTestEnv ? 'exam_monitoring_test' : 'proctoriq'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(isTestEnv ? 30 : 15),
  DB_SSL: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      const lower = String(val).toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    })
    .default(false),
  DB_SSL_CA: z.string().optional(),
  DB_CA_CERT: z.string().optional(),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .default('dev-proctoriq-jwt-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  OTP_PEPPER: z
    .string()
    .min(16, 'OTP_PEPPER must be at least 16 characters')
    .default('dev-proctoriq-otp-pepper-default-secret-min32chars'),
  MAIL_PROVIDER: z.enum(['smtp', 'console', 'mock']).default(isTestEnv ? 'mock' : 'console'),
  MAIL_FROM: z.string().default(process.env.SMTP_FROM || 'ProctorIQ Security <no-reply@proctoriq.io>'),
  APP_BASE_URL: z.string().default(isTestEnv ? 'http://localhost:5174' : 'http://localhost:5173'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      const lower = String(val).toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    })
    .default(false),
  SMTP_FROM: z.string().default('ProctorIQ Security <no-reply@proctoriq.io>'),
  // Configurable paths relative to project root
  DB_SCHEMA_PATH: z.string().default('./db/schema.sql'),
  DB_MIGRATIONS_DIR: z.string().default('./db/migrations'),
  DB_SEED_PATH: z.string().default('./db/seed.sql'),
  UPLOADS_DIR: z.string().default(isTestEnv ? './server/uploads-test' : './server/uploads'),
  EXTENSION_GRACE_SECONDS: z.coerce.number().int().min(0).default(180),
  WARNING_GRACE_SECONDS: z.coerce.number().int().min(0).default(5),
  RECORDING_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  RECORDING_MAX_STORAGE_GB: z.coerce.number().positive().default(5),
  STORAGE_PROVIDER: z.enum(['blob', 's3', 'local']).default(isTestEnv ? 'local' : 'local'),
  STORAGE_PREFIX: z.string().default(isTestEnv ? 'test/' : ''),
  CRON_SECRET: z.string().default(isTestEnv ? 'test-cron-secret-token' : ''),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      const lower = String(val).toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    })
    .default(true),
  REALTIME_PROVIDER: z.enum(['pusher', 'polling']).default('polling'),
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().default('mt1'),
  PUSHER_USE_TLS: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      const lower = String(val).toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    })
    .default(true),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Strict Safety Guard:
 * Refuses execution of destructive, test, or seeding operations unless
 * NODE_ENV === 'test' AND the target DB_NAME strictly ends with '_test'.
 */
export function assertTestDatabaseSafety(operation = 'test execution / destructive reset'): void {
  if (env.NODE_ENV !== 'test') {
    throw new Error(
      `[SAFETY GUARD VIOLATION] Operation '${operation}' is prohibited because NODE_ENV is '${env.NODE_ENV}', not 'test'.`
    );
  }

  if (!env.DB_NAME || !env.DB_NAME.endsWith('_test')) {
    throw new Error(
      `[SAFETY GUARD VIOLATION] Operation '${operation}' is prohibited because DB_NAME is '${env.DB_NAME}'. Target database MUST end with '_test' (e.g. 'exam_monitoring_test'). Real production/development database '${env.DB_NAME}' is strictly protected and will never be touched by tests.`
    );
  }
}

// Enforce guard at load time if in test mode
if (env.NODE_ENV === 'test' && !env.DB_NAME.endsWith('_test')) {
  console.error(
    `\n🚨 [SAFETY GUARD TRIGGERED] Attempted to run tests with DB_NAME='${env.DB_NAME}'. Automated tests are strictly forbidden from pointing to real database. Target DB must end with '_test'.\n`
  );
  throw new Error(
    `[SAFETY GUARD TRIGGERED] Test environment requires DB_NAME ending in '_test'. Found '${env.DB_NAME}'.`
  );
}

/**
 * Validates mail configuration based on selected provider.
 * Throws actionable errors listing missing variables or illegal production combinations.
 */
export function validateMailConfig(targetEnv: Partial<typeof env> = env): void {
  const provider = targetEnv.MAIL_PROVIDER;
  const nodeEnv = targetEnv.NODE_ENV;

  if (nodeEnv === 'production' && provider === 'console') {
    throw new Error(
      `[MailService] MAIL_PROVIDER="console" is forbidden in production environments. Please configure MAIL_PROVIDER="smtp" with valid SMTP credentials.`
    );
  }

  if (provider === 'smtp') {
    const missing: string[] = [];
    if (!targetEnv.SMTP_HOST) missing.push('SMTP_HOST');
    if (!targetEnv.SMTP_PORT) missing.push('SMTP_PORT');
    if (!targetEnv.SMTP_USER) missing.push('SMTP_USER');
    if (!targetEnv.SMTP_PASS) missing.push('SMTP_PASS');
    if (!targetEnv.MAIL_FROM && !targetEnv.SMTP_FROM) missing.push('MAIL_FROM');

    if (missing.length > 0) {
      throw new Error(
        `[MailService] Missing required SMTP configuration variables: ${missing.join(', ')}. Please define these in your environment or .env file.`
      );
    }
  }
}


