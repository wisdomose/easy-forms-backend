import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'provision']).default('development'),
  DATABASE_URL: z.string().min(1).default('pgmem'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  R2_ENDPOINT: z.string().url().default('https://example.r2.cloudflarestorage.com'),
  R2_ACCESS_KEY_ID: z.string().min(1).default('local-access-key'),
  R2_SECRET_ACCESS_KEY: z.string().min(1).default('local-secret-key'),
  R2_BUCKET: z.string().min(1).default('form-engine-local'),
  WORKOS_AUDIENCE: z.string().min(1).default('form-engine'),
  WORKOS_ISSUER: z.string().url().default('https://api.workos.com'),
  WORKOS_JWKS_URL: z.string().url().optional(),
  WORKOS_JWT_SECRET: z.string().min(1).default('test-workos-secret'),
  WEBHOOK_DELIVERY_ENABLED: z.coerce.boolean().default(false),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment variable validation failed: ${result.error.message}`);
  }
  return result.data;
}
