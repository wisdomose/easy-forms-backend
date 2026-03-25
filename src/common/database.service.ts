import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newDb } from 'pg-mem';
import { Pool, PoolClient, QueryResult } from 'pg';

type SqlPrimitive = string | number | boolean | null;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL', 'pgmem');

    if (connectionString === 'pgmem' || this.configService.get('NODE_ENV') === 'test') {
      const db = newDb({ autoCreateForeignKeyIndices: true });
      const adapter = db.adapters.createPg();
      this.pool = new adapter.Pool();
    } else {
      this.pool = new Pool({ connectionString });
    }

    await this.bootstrap();
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async query<T = unknown>(text: string, params: SqlPrimitive[] = []): Promise<QueryResult<T>> {
    return this.pool.query(text, params);
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async bootstrap() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        workos_subject TEXT UNIQUE NOT NULL,
        email TEXT,
        name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workspace_memberships (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS permission_assignments (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        membership_id UUID REFERENCES workspace_memberships(id) ON DELETE CASCADE,
        principal_type TEXT NOT NULL,
        principal_id UUID NOT NULL,
        permission_key TEXT NOT NULL,
        effect TEXT NOT NULL,
        scope_type TEXT,
        scope_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        hashed_key TEXT NOT NULL,
        created_by UUID REFERENCES users(id),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS forms (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        published_version INTEGER,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS form_versions (
        id UUID PRIMARY KEY,
        form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        schema_json JSONB NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(form_id, version)
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY,
        form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        values_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY,
        form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        events JSONB NOT NULL,
        signing_secret TEXT NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id UUID PRIMARY KEY,
        webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        event_name TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        next_attempt_at TIMESTAMPTZ,
        last_attempt_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analytics_daily (
        id UUID PRIMARY KEY,
        form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        event_date DATE NOT NULL,
        views_count INTEGER NOT NULL DEFAULT 0,
        starts_count INTEGER NOT NULL DEFAULT 0,
        completes_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(form_id, event_date)
      );
      CREATE TABLE IF NOT EXISTS retention_policies (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
        ttl_days INTEGER NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(workspace_id, form_id)
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
}
