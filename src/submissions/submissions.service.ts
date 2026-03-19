import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InMemoryStore, SubmissionRecord } from '../common/in-memory.store';
import { FormsService } from '../forms/forms.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly formsService: FormsService,
  ) {}

  create(formId: string, values: Record<string, unknown>) {
    const form = this.formsService.getById(formId);
    const version = this.formsService.getPublishedVersion(form);
    const { fields, condition_groups, redirects } = version.schema_json;

    const visibleFields = fields.filter((field) => {
      if (
        this.formsService.evaluateConditionGroups(
          values,
          condition_groups,
          field.key,
          'hide',
        )
      ) {
        return false;
      }

      const hasShowRule = condition_groups.some(
        (group) => group.field_key === field.key && group.effect === 'show',
      );

      if (!hasShowRule) {
        return true;
      }

      return this.formsService.evaluateConditionGroups(
        values,
        condition_groups,
        field.key,
        'show',
      );
    });

    for (const field of visibleFields) {
      const requiredByCondition = this.formsService.evaluateConditionGroups(
        values,
        condition_groups,
        field.key,
        'require',
      );
      const isRequired = field.required || requiredByCondition;
      const value = values[field.key];
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      if (isRequired && (value === undefined || value === null || value === '' || isEmptyArray)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Field ${field.key} is required`,
          details: { field: field.key },
        });
      }
    }

    const submission: SubmissionRecord = {
      id: randomUUID(),
      form_id: formId,
      version: version.version,
      created_at: new Date().toISOString(),
      values: Object.fromEntries(
        visibleFields.map((field) => [field.key, this.normalizeValue(values[field.key])]),
      ) as SubmissionRecord['values'],
    };

    this.store.submissions.push(submission);

    const redirectUrl = redirects.find((redirect) => {
      if (!redirect.condition_group_id) {
        return true;
      }

      const group = condition_groups.find(
        (entry) => entry.id === redirect.condition_group_id,
      );

      if (!group) {
        return false;
      }

      return this.formsService.evaluateConditionGroups(
        values,
        [group],
        group.field_key,
        group.effect,
      );
    })?.url;

    return {
      submission_id: submission.id,
      redirect_url: redirectUrl ?? null,
    };
  }

  list(formId: string) {
    return this.store.submissions.filter((submission) => submission.form_id === formId);
  }

  private normalizeValue(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry));
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return value;
    }
    if (value === undefined) {
      return null;
    }
    return String(value);
  }
}
