import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database.service';
import { FormsService } from '../forms/forms.service';
import { AuthContext } from '../auth/auth.service';
import { PermissionsService } from '../auth/permissions.service';
import { WorkerService } from '../common/worker.service';
import { RateLimitService } from '../common/rate-limit.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly forms: FormsService,
    private readonly permissions: PermissionsService,
    private readonly worker: WorkerService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async create(formId: string, values: Record<string, unknown>) {
    const form = await this.forms.getById(formId);
    this.rateLimit.consumeSubmission(form.workspace_id, formId);
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
    await this.attachUploadedFiles(formId, submissionId, visibleFields, values);
    await this.recordEvent(formId, 'complete', { submission_id: submissionId });
    const redirect = (schema.redirects ?? []).find((entry: any) => !entry.condition_group_id || this.groupMatches(values, (schema.condition_groups ?? []).find((group: any) => group.id === entry.condition_group_id)))?.url ?? null;
    await this.enqueueWebhookDeliveries(formId, submissionId);
    return { submission_id: submissionId, redirect_url: redirect };
  }

  async list(auth: AuthContext, formId: string) {
    const form = await this.forms.getById(formId);
    await this.permissions.assertPermission(auth, form.workspace_id, 'submissions.read', 'form', formId);
    return this.db.query('SELECT id, form_id, version, values_json AS values, created_at FROM submissions WHERE form_id = $1 ORDER BY created_at DESC', [formId]).then((r) => r.rows);
  }

  async trackEvent(formId: string, eventName: 'view' | 'start') {
    const form = await this.forms.getById(formId);
    this.rateLimit.consumeSubmission(form.workspace_id, formId);
    await this.recordEvent(formId, eventName, {});
    return { tracked: true, event: eventName };
  }

  private async recordEvent(formId: string, eventName: 'view' | 'start' | 'complete', metadata: Record<string, unknown>) {
    const eventDate = new Date().toISOString().slice(0, 10);
    await this.db.query(
      'INSERT INTO form_events (id, form_id, event_name, event_date, metadata_json) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [randomUUID(), formId, eventName, eventDate, JSON.stringify(metadata)],
    );
    await this.worker.enqueue('analytics.aggregate', { form_id: formId, event_name: eventName, event_date: eventDate });
  }

  private async attachUploadedFiles(formId: string, submissionId: string, fields: any[], values: Record<string, unknown>) {
    for (const field of fields.filter((entry) => entry.type === 'file')) {
      const value = values[field.key];
      const refs = Array.isArray(value) ? value : value ? [value] : [];
      for (const ref of refs) {
        if (typeof ref === 'string') {
          await this.db.query(
            `UPDATE form_files
             SET submission_id = $2, status = 'attached'
             WHERE form_id = $1 AND storage_key = $3`,
            [formId, submissionId, ref],
          );
        }
      }
    }
  }

  private async enqueueWebhookDeliveries(formId: string, submissionId: string) {
    const webhooks = await this.db.query<any>('SELECT * FROM webhooks WHERE form_id = $1', [formId]);
    for (const webhook of webhooks.rows) {
      const deliveryId = randomUUID();
      await this.db.query(
        'INSERT INTO webhook_deliveries (id, webhook_id, submission_id, event_name, status) VALUES ($1, $2, $3, $4, $5)',
        [deliveryId, webhook.id, submissionId, 'submission.created', 'pending'],
      );
      await this.worker.enqueue('webhook.delivery', { delivery_id: deliveryId });
    }
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
}
