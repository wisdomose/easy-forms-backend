import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { DatabaseService } from '../common/database.service';
import { FormsService } from '../forms/forms.service';
import { AuthContext } from '../auth/auth.service';
import { PermissionsService } from '../auth/permissions.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly forms: FormsService,
    private readonly permissions: PermissionsService,
    private readonly config: ConfigService,
  ) {}

  async create(formId: string, values: Record<string, unknown>) {
    const form = await this.forms.getById(formId);
    if (!form.published_version) {
      throw new BadRequestException({ code: 'FORM_NOT_PUBLISHED', message: 'Form is not published' });
    }
    const version = await this.forms.getVersion(formId, form.published_version);
    const schema = version.schema_json;
    const visibleFields = (schema.fields as any[]).filter((field) => this.isVisible(values, schema.condition_groups ?? [], field.key));

    for (const field of visibleFields) {
      const required = field.required || this.matchesEffect(values, schema.condition_groups ?? [], field.key, 'require');
      const value = values[field.key];
      const emptyArray = Array.isArray(value) && value.length === 0;
      if (required && (value === undefined || value === null || value === '' || emptyArray)) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `Field ${field.key} is required`, details: { field: field.key } });
      }
    }

    const normalized = Object.fromEntries(visibleFields.map((field) => [field.key, this.normalizeValue(values[field.key])]));
    const submissionId = randomUUID();
    await this.db.query('INSERT INTO submissions (id, form_id, version, values_json) VALUES ($1, $2, $3, $4::jsonb)', [submissionId, formId, form.published_version, JSON.stringify(normalized)]);
    await this.db.query(
      `INSERT INTO analytics_daily (id, form_id, event_date, completes_count)
       VALUES ($1, $2, CURRENT_DATE, 1)
       ON CONFLICT (form_id, event_date)
       DO UPDATE SET completes_count = analytics_daily.completes_count + 1`,
      [randomUUID(), formId],
    );
    const redirect = (schema.redirects ?? []).find((entry: any) => !entry.condition_group_id || this.groupMatches(values, (schema.condition_groups ?? []).find((group: any) => group.id === entry.condition_group_id)))?.url ?? null;
    await this.enqueueWebhookDeliveries(formId, submissionId, normalized);
    return { submission_id: submissionId, redirect_url: redirect };
  }

  async list(auth: AuthContext, formId: string) {
    const form = await this.forms.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'submissions.read', 'form', formId);
    return this.db.query('SELECT id, form_id, version, values_json AS values, created_at FROM submissions WHERE form_id = $1 ORDER BY created_at DESC', [formId]).then((r) => r.rows);
  }

  private isVisible(values: Record<string, unknown>, groups: any[], fieldKey: string) {
    if (this.matchesEffect(values, groups, fieldKey, 'hide')) return false;
    const hasShow = groups.some((group) => group.field_key === fieldKey && group.effect === 'show');
    return !hasShow || this.matchesEffect(values, groups, fieldKey, 'show');
  }

  private matchesEffect(values: Record<string, unknown>, groups: any[], fieldKey: string, effect: string) {
    return groups.filter((group) => group.field_key === fieldKey && group.effect === effect).some((group) => this.groupMatches(values, group));
  }

  private groupMatches(values: Record<string, unknown>, group?: any) {
    if (!group) return false;
    const checks = (group.conditions ?? []).map((condition: any) => {
      const left = values[condition.if_field_key];
      const right = this.parseValue(condition.value);
      switch (condition.operator) {
        case 'eq': return left === right;
        case 'neq': return left !== right;
        case 'gt': return Number(left) > Number(right);
        case 'gte': return Number(left) >= Number(right);
        case 'lt': return Number(left) < Number(right);
        case 'lte': return Number(left) <= Number(right);
        case 'contains': return Array.isArray(left) ? left.includes(right) : String(left ?? '').includes(String(right));
        case 'in': return Array.isArray(right) && right.includes(left as never);
        default: return false;
      }
    });
    return group.operator === 'AND' ? checks.every(Boolean) : checks.some(Boolean);
  }

  private parseValue(value: string) {
    try { return JSON.parse(value); } catch { return value; }
  }

  private normalizeValue(value: unknown) {
    if (Array.isArray(value)) return value.map((entry) => String(entry));
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
    if (value === undefined) return null;
    return String(value);
  }

  private async enqueueWebhookDeliveries(formId: string, submissionId: string, values: Record<string, unknown>) {
    const webhooks = await this.db.query<any>('SELECT * FROM webhooks WHERE form_id = $1', [formId]);
    for (const webhook of webhooks.rows) {
      const deliveryId = randomUUID();
      await this.db.query(
        'INSERT INTO webhook_deliveries (id, webhook_id, submission_id, event_name, status) VALUES ($1, $2, $3, $4, $5)',
        [deliveryId, webhook.id, submissionId, 'submission.created', 'pending'],
      );
      if (this.config.get<boolean>('WEBHOOK_DELIVERY_ENABLED')) {
        await this.deliverWebhook(deliveryId, webhook, { submission_id: submissionId, values });
      }
    }
  }

  private async deliverWebhook(deliveryId: string, webhook: any, payload: Record<string, unknown>) {
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', webhook.signing_secret).update(rawBody).digest('hex');
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-formengine-signature': signature,
          'x-formengine-event': 'submission.created',
          'x-formengine-delivery': deliveryId,
        },
        body: rawBody,
        signal: AbortSignal.timeout(this.config.get<number>('WEBHOOK_TIMEOUT_MS', 4000)),
      });
      const body = await response.text();
      await this.db.query(
        'UPDATE webhook_deliveries SET attempt_count = attempt_count + 1, status = $2, response_status = $3, response_body = $4, last_attempt_at = NOW() WHERE id = $1',
        [deliveryId, response.ok ? 'delivered' : 'failed', response.status, body],
      );
    } catch (error) {
      await this.db.query(
        'UPDATE webhook_deliveries SET attempt_count = attempt_count + 1, status = $2, response_body = $3, next_attempt_at = NOW() + INTERVAL \"5 minutes\", last_attempt_at = NOW() WHERE id = $1',
        [deliveryId, 'failed', error instanceof Error ? error.message : 'Unknown error'],
      );
    }
  }
}
