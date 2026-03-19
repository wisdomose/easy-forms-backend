import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('throws when the form bucket is exhausted', () => {
    const config = {
      get: (key: string, fallback: number) => {
        const values: Record<string, number> = {
          RATE_LIMIT_WORKSPACE_LIMIT: 10,
          RATE_LIMIT_WORKSPACE_WINDOW_MS: 60000,
          RATE_LIMIT_FORM_LIMIT: 2,
          RATE_LIMIT_FORM_WINDOW_MS: 60000,
        };
        return values[key] ?? fallback;
      },
    } as ConfigService;

    const service = new RateLimitService(config);
    service.consumeSubmission('workspace-1', 'form-1');
    service.consumeSubmission('workspace-1', 'form-1');

    expect(() => service.consumeSubmission('workspace-1', 'form-1')).toThrow(HttpException);
  });
});
