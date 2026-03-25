import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Bucket = { tokens: number; lastRefillAt: number };

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly config: ConfigService) {}

  consume(bucketKey: string, limit: number, windowMs: number) {
    const now = Date.now();
    const refillRate = limit / windowMs;
    const bucket = this.buckets.get(bucketKey) ?? { tokens: limit, lastRefillAt: now };
    const elapsed = now - bucket.lastRefillAt;
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
    bucket.lastRefillAt = now;

    if (bucket.tokens < 1) {
      throw new HttpException({
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        details: { bucket: bucketKey, retry_after_ms: Math.ceil((1 - bucket.tokens) / refillRate) },
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.tokens -= 1;
    this.buckets.set(bucketKey, bucket);
  }

  consumeSubmission(workspaceId: string, formId: string) {
    const workspaceLimit = this.config.get<number>('RATE_LIMIT_WORKSPACE_LIMIT', 120);
    const workspaceWindow = this.config.get<number>('RATE_LIMIT_WORKSPACE_WINDOW_MS', 60_000);
    const formLimit = this.config.get<number>('RATE_LIMIT_FORM_LIMIT', 30);
    const formWindow = this.config.get<number>('RATE_LIMIT_FORM_WINDOW_MS', 60_000);
    this.consume(`workspace:${workspaceId}`, workspaceLimit, workspaceWindow);
    this.consume(`form:${formId}`, formLimit, formWindow);
  }
}
