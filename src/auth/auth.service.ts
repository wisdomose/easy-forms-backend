import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../common/database.service';

export type AuthContext = {
  type: 'user' | 'api_key';
  actorId: string;
  workspaceId?: string;
  userId?: string;
  membershipId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async authenticate(authorization?: string): Promise<AuthContext> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing bearer token' });
    }

    const token = authorization.slice('Bearer '.length);
    if (token.startsWith('fe_')) {
      return this.authenticateApiKey(token);
    }

    return this.authenticateWorkosUser(token);
  }

  async createOrSyncUser(payload: { sub: string; email?: string; name?: string }) {
    const existing = await this.db.query<{ id: string }>('SELECT id FROM users WHERE workos_subject = $1', [payload.sub]);
    if (existing.rowCount) {
      const id = existing.rows[0].id;
      await this.db.query('UPDATE users SET email = $2, name = $3, updated_at = NOW() WHERE id = $1', [id, payload.email ?? null, payload.name ?? null]);
      return id;
    }

    const id = randomUUID();
    await this.db.query('INSERT INTO users (id, workos_subject, email, name) VALUES ($1, $2, $3, $4)', [id, payload.sub, payload.email ?? null, payload.name ?? null]);
    return id;
  }

  hashApiKey(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }

  private async authenticateApiKey(token: string): Promise<AuthContext> {
    const prefix = token.slice(0, 12);
    const result = await this.db.query<{ id: string; workspace_id: string; hashed_key: string }>('SELECT id, workspace_id, hashed_key FROM api_keys WHERE key_prefix = $1 AND revoked_at IS NULL', [prefix]);

    for (const row of result.rows) {
      const expected = Buffer.from(row.hashed_key, 'hex');
      const actual = Buffer.from(this.hashApiKey(token), 'hex');
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        await this.db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]);
        return { type: 'api_key', actorId: row.id, workspaceId: row.workspace_id };
      }
    }

    throw new UnauthorizedException({ code: 'INVALID_API_KEY', message: 'API key is invalid' });
  }

  private async authenticateWorkosUser(token: string): Promise<AuthContext> {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'JWT is malformed' });
    }

    const input = `${encodedHeader}.${encodedPayload}`;
    const expected = createHmac('sha256', this.config.get<string>('WORKOS_JWT_SECRET', 'test-workos-secret')).update(input).digest('base64url');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'JWT signature is invalid' });
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== this.config.get('WORKOS_ISSUER') || payload.aud !== this.config.get('WORKOS_AUDIENCE') || typeof payload.exp !== 'number' || payload.exp < now || typeof payload.sub !== 'string') {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'JWT claims are invalid' });
    }

    const userId = await this.createOrSyncUser({
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    });

    return { type: 'user', actorId: userId, userId };
  }
}
