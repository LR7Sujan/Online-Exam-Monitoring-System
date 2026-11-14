import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve .env candidate paths relative to script location / project root
const candidateEnvPaths = [
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
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

