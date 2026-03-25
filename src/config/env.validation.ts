import { z } from 'zod';

const requiredOutsideTest = (fallback: string) =>
  z.string().min(1).default(fallback);

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: requiredOutsideTest('postgres://localhost:5432/form-engine'),
  REDIS_URL: requiredOutsideTest('redis://localhost:6379'),
  R2_ENDPOINT: z.string().url().default('https://example.r2.cloudflarestorage.com'),
  R2_ACCESS_KEY_ID: requiredOutsideTest('local-access-key'),
  R2_SECRET_ACCESS_KEY: requiredOutsideTest('local-secret-key'),
  R2_BUCKET: requiredOutsideTest('form-engine-local'),
  NODE_ENV: z.enum(['development', 'production', 'test', 'provision']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment variable validation failed: ${result.error.message}`);
  }
  return result.data;
}
