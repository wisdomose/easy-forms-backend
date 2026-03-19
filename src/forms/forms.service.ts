import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { AuthContext } from '../auth/auth.service';
import { PermissionsService } from '../auth/permissions.service';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class FormsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(auth: AuthContext, workspaceId: string, name: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'forms.manage');
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO forms (id, workspace_id, name, status, created_by) VALUES ($1, $2, $3, $4, $5)',
      [id, workspaceId, name, 'draft', auth.userId ?? null],
    );
    return this.getById(id);
  }

  async update(auth: AuthContext, formId: string, updates: { name?: string; status?: string }) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'forms.manage', 'form', formId);
    await this.db.query(
      'UPDATE forms SET name = COALESCE($2, name), status = COALESCE($3, status), updated_at = NOW() WHERE id = $1',
      [formId, updates.name ?? null, updates.status ?? null],
    );
    return this.getById(formId);
  }

  async listByWorkspace(auth: AuthContext, workspaceId: string) {
    await this.permissions.assertPermission(auth, workspaceId, 'forms.manage');
    return this.db.query('SELECT * FROM forms WHERE workspace_id = $1 ORDER BY created_at ASC', [workspaceId]).then((r) => r.rows);
  }

  async saveVersion(auth: AuthContext, formId: string, payload: any) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'forms.manage', 'form', formId);
    this.assertUniqueFieldKeys(payload.fields ?? []);
    this.assertNoConditionCycles(payload.fields ?? [], payload.condition_groups ?? []);
    const versionResult = await this.db.query<{ next_version: number }>(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM form_versions WHERE form_id = $1',
      [formId],
    );
    const version = Number(versionResult.rows[0].next_version);
    const id = randomUUID();
    const schema = {
      fields: payload.fields ?? [],
      condition_groups: payload.condition_groups ?? [],
      redirects: [...(payload.redirects ?? [])].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
    };
    await this.db.query(
      'INSERT INTO form_versions (id, form_id, version, schema_json, created_by) VALUES ($1, $2, $3, $4::jsonb, $5)',
      [id, formId, version, JSON.stringify(schema), auth.userId ?? null],
    );
    return { id, version, schema_json: schema };
  }

  async publish(auth: AuthContext, formId: string, version: number) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'forms.manage', 'form', formId);
    const resolved = await this.getVersion(formId, version);
    await this.db.query('UPDATE forms SET published_version = $2, status = $3, updated_at = NOW() WHERE id = $1', [formId, version, 'active']);
    return { ...(await this.getById(formId)), published_schema: resolved.schema_json };
  }

  async getCompiledSchema(formId: string) {
    const form = await this.getById(formId);
    if (!form.published_version) {
      throw new BadRequestException({ code: 'FORM_NOT_PUBLISHED', message: 'Form does not have a published version' });
    }
    const version = await this.getVersion(formId, form.published_version);
    return {
      form: { id: form.id, name: form.name, workspace_id: form.workspace_id, version: form.published_version },
      ...version.schema_json,
    };
  }

  async getById(formId: string) {
    const result = await this.db.query<any>('SELECT * FROM forms WHERE id = $1', [formId]);
    if (!result.rowCount) {
      throw new NotFoundException({ code: 'FORM_NOT_FOUND', message: 'Form was not found' });
    }
    return result.rows[0];
  }

  async getVersion(formId: string, version: number) {
    const result = await this.db.query<any>('SELECT * FROM form_versions WHERE form_id = $1 AND version = $2', [formId, version]);
    if (!result.rowCount) {
      throw new NotFoundException({ code: 'VERSION_NOT_FOUND', message: `Version ${version} was not found` });
    }
    return result.rows[0];
  }

  async createWebhook(auth: AuthContext, formId: string, url: string, events: string[]) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'webhooks.manage', 'form', formId);
    const id = randomUUID();
    const signingSecret = randomBytes(24).toString('hex');
    await this.db.query(
      'INSERT INTO webhooks (id, form_id, url, events, signing_secret, created_by) VALUES ($1, $2, $3, $4::jsonb, $5, $6)',
      [id, formId, url, JSON.stringify(events), signingSecret, auth.userId ?? null],
    );
    return { id, url, events, signing_secret: signingSecret };
  }

  async listWebhooks(auth: AuthContext, formId: string) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'webhooks.manage', 'form', formId);
    return this.db.query('SELECT id, url, events, created_at FROM webhooks WHERE form_id = $1 ORDER BY created_at ASC', [formId]).then((r) => r.rows);
  }

  async deleteWebhook(auth: AuthContext, formId: string, webhookId: string) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'webhooks.manage', 'form', formId);
    await this.db.query('DELETE FROM webhooks WHERE id = $1 AND form_id = $2', [webhookId, formId]);
    return { deleted: true };
  }

  async getAnalytics(auth: AuthContext, formId: string, range = '7d') {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'analytics.read', 'form', formId);
    const days = Number(range.replace(/d$/, '')) || 7;
    return this.db.query(
      `SELECT event_date, views_count, starts_count, completes_count
       FROM analytics_daily
       WHERE form_id = $1 AND event_date >= CURRENT_DATE - ($2::int - 1)
       ORDER BY event_date ASC`,
      [formId, days],
    ).then((r) => r.rows);
  }

  async setRetention(auth: AuthContext, target: { workspaceId?: string; formId?: string }, ttlDays: number) {
    const workspaceId = target.workspaceId ?? (await this.getById(target.formId!)).workspace_id;
    await this.permissions.assertPermission(auth, workspaceId, 'retention.manage', target.formId ? 'form' : undefined, target.formId);
    const existing = target.formId
      ? await this.db.query<{ id: string }>('SELECT id FROM retention_policies WHERE form_id = $1', [target.formId])
      : await this.db.query<{ id: string }>('SELECT id FROM retention_policies WHERE workspace_id = $1 AND form_id IS NULL', [target.workspaceId!]);
    if (existing.rowCount) {
      await this.db.query('UPDATE retention_policies SET ttl_days = $2 WHERE id = $1', [existing.rows[0].id, ttlDays]);
      return { id: existing.rows[0].id, ttl_days: ttlDays };
    }
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO retention_policies (id, workspace_id, form_id, ttl_days, created_by) VALUES ($1, $2, $3, $4, $5)',
      [id, target.workspaceId ?? null, target.formId ?? null, ttlDays, auth.userId ?? null],
    );
    return { id, ttl_days: ttlDays };
  }

  async getRetention(auth: AuthContext, target: { workspaceId?: string; formId?: string }) {
    const workspaceId = target.workspaceId ?? (await this.getById(target.formId!)).workspace_id;
    await this.permissions.assertPermission(auth, workspaceId, 'retention.manage', target.formId ? 'form' : undefined, target.formId);
    const result = target.formId
      ? await this.db.query('SELECT id, workspace_id, form_id, ttl_days, created_at FROM retention_policies WHERE form_id = $1', [target.formId])
      : await this.db.query('SELECT id, workspace_id, form_id, ttl_days, created_at FROM retention_policies WHERE workspace_id = $1 AND form_id IS NULL', [target.workspaceId!]);
    return result.rows[0] ?? null;
  }

  async createPresignedUpload(auth: AuthContext, formId: string, fieldKey: string, filename: string, mime: string) {
    const form = await this.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'forms.manage', 'form', formId);
    const storageKey = `${formId}/${fieldKey}/${Date.now()}-${filename}`;
    const signature = createHmac('sha256', 'r2-local-signing').update(`${storageKey}:${mime}`).digest('hex');
    return { upload_url: `https://uploads.local/${storageKey}?signature=${signature}`, storage_key: storageKey };
  }

  private assertUniqueFieldKeys(fields: Array<{ key: string }>) {
    const seen = new Set<string>();
    for (const field of fields) {
      if (seen.has(field.key)) {
        throw new BadRequestException({ code: 'DUPLICATE_FIELD_KEY', message: `Field key ${field.key} is duplicated` });
      }
      seen.add(field.key);
    }
  }

  private assertNoConditionCycles(fields: Array<{ key: string }>, groups: Array<any>) {
    const fieldKeys = new Set(fields.map((field) => field.key));
    const graph = new Map<string, Set<string>>();
    for (const key of fieldKeys) graph.set(key, new Set());
    for (const group of groups) {
      if (!fieldKeys.has(group.field_key)) {
        throw new BadRequestException({ code: 'UNKNOWN_FIELD_REFERENCE', message: `Unknown field ${group.field_key}` });
      }
      for (const condition of group.conditions ?? []) {
        if (!fieldKeys.has(condition.if_field_key)) {
          throw new BadRequestException({ code: 'UNKNOWN_FIELD_REFERENCE', message: `Unknown field ${condition.if_field_key}` });
        }
        graph.get(condition.if_field_key)?.add(group.field_key);
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const dfs = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const next of graph.get(node) ?? []) if (dfs(next)) return true;
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    for (const key of graph.keys()) {
      if (dfs(key)) {
        throw new BadRequestException({ code: 'FIELD_CONDITION_CYCLE', message: 'Field conditions contain a dependency cycle' });
      }
    }
  }
}
