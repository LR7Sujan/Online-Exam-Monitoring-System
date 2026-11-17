import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTestEnv = process.env.NODE_ENV === 'test';

// Resolve .env candidate paths relative to script location / project root
const candidateEnvPaths = [
  process.env.ENV_FILE,
  process.env.DOTENV_CONFIG_PATH,
  ...(isTestEnv
    ? [
        path.resolve(__dirname, '../../.env.test'),
        path.resolve(__dirname, '../../../.env.test'),
      ]
    : []),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
].filter(Boolean) as string[];

for (const envPath of candidateEnvPaths) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default('proctoriq_root'),
  DB_NAME: z.string().min(1).default('proctoriq'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .default('dev-proctoriq-jwt-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  // Configurable paths relative to project root
  DB_SCHEMA_PATH: z.string().default('./db/schema.sql'),
  DB_MIGRATIONS_DIR: z.string().default('./db/migrations'),
  DB_SEED_PATH: z.string().default('./db/seed.sql'),
  UPLOADS_DIR: z.string().default('./server/uploads'),
  EXTENSION_GRACE_SECONDS: z.coerce.number().int().min(0).default(180),
  WARNING_GRACE_SECONDS: z.coerce.number().int().min(0).default(5),
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

