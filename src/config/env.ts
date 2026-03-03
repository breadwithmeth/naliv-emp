import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  KEYCLOAK_BASE_URL: z.string().url(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_JWKS_URI: z.string().url(),
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_INTROSPECTION_URL: z.string().url(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_ALLOWED_AUDIENCE: z.string().min(1),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  PRESENCE_IDLE_MINUTES: z.coerce.number().positive().default(5),
  PRESENCE_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(60000),

  OWNTRACKS_BASIC_USER: z.string().min(1),
  OWNTRACKS_BASIC_PASS: z.string().min(1),

  TRACCAR_BASIC_USER: z.string().min(1),
  TRACCAR_BASIC_PASS: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

const allowedAudiences = parsed.data.KEYCLOAK_ALLOWED_AUDIENCE
  .split(',')
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

if (allowedAudiences.length === 0) {
  throw new Error('Invalid environment: KEYCLOAK_ALLOWED_AUDIENCE must contain at least one audience');
}

export const env = {
  ...parsed.data,
  KEYCLOAK_ALLOWED_AUDIENCES: allowedAudiences
} as const;
