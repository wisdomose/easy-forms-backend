import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { newDb } from 'pg-mem';
import { Pool, PoolClient, QueryResult } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as schema from '../db/schema';

type SqlPrimitive = string | number | boolean | null;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  private db!: NodePgDatabase<typeof schema>;
  private inMemory = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL', 'pgmem');

    if (connectionString === 'pgmem' || this.configService.get('NODE_ENV') === 'test') {
      const db = newDb({ autoCreateForeignKeyIndices: true });
      const adapter = db.adapters.createPg();
      this.pool = new adapter.Pool();
      this.inMemory = true;
    } else {
      this.pool = new Pool({ connectionString });
    }

    this.db = drizzle(this.pool, { schema });
    if (!this.inMemory) {
      await this.runMigrations();
    }
    await this.applyBaselineSqlFallback();
    await this.ensureFormEventsPartitionHelper();
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  getDrizzle() {
    return this.db;
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

  private async runMigrations() {
    await migrate(this.db, {
      migrationsFolder: join(process.cwd(), 'drizzle'),
    });
  }


  private async applyBaselineSqlFallback() {
    const baselineSql = readFileSync(join(process.cwd(), 'drizzle', '0000_phase1_foundations.sql'), 'utf8');
    await this.query(baselineSql);
  }

  private async ensureFormEventsPartitionHelper() {
    await this.query('CREATE INDEX IF NOT EXISTS idx_form_events_event_date ON form_events (event_date, form_id)');
  }
}
