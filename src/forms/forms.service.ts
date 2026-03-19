import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ConditionEffect,
  ConditionGroup,
  FormField,
  FormRecord,
  FormStatus,
  FormVersion,
  InMemoryStore,
  RedirectRule,
} from '../common/in-memory.store';

type SaveVersionInput = {
  fields: FormField[];
  condition_groups?: ConditionGroup[];
  redirects?: RedirectRule[];
};

@Injectable()
export class FormsService {
  constructor(private readonly store: InMemoryStore) {}

  create(workspaceId: string, name: string): FormRecord {
    const form: FormRecord = {
      id: randomUUID(),
      workspace_id: workspaceId,
      name,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_version: null,
      versions: [],
    };

    this.store.forms.push(form);
    return form;
  }

  update(id: string, updates: { name?: string; status?: FormStatus }) {
    const form = this.getById(id);
    if (updates.name) form.name = updates.name;
    if (updates.status) form.status = updates.status;
    form.updated_at = new Date().toISOString();
    return form;
  }

  listByWorkspace(workspaceId: string) {
    return this.store.forms.filter((form) => form.workspace_id === workspaceId);
  }

  saveVersion(id: string, input: SaveVersionInput): FormVersion {
    const form = this.getById(id);
    const conditionGroups = input.condition_groups ?? [];
    this.assertUniqueFieldKeys(input.fields);
    this.assertNoConditionCycles(input.fields, conditionGroups);

    const version: FormVersion = {
      id: randomUUID(),
      version: form.versions.length + 1,
      created_at: new Date().toISOString(),
      schema_json: {
        fields: input.fields,
        condition_groups: conditionGroups,
        redirects: [...(input.redirects ?? [])].sort(
          (a, b) => a.position - b.position || a.id.localeCompare(b.id),
        ),
      },
    };

    form.versions.push(version);
    form.updated_at = new Date().toISOString();
    return version;
  }

  publish(id: string, versionNumber: number) {
    const form = this.getById(id);
    const version = form.versions.find((entry) => entry.version === versionNumber);
    if (!version) {
      throw new NotFoundException({
        code: 'VERSION_NOT_FOUND',
        message: `Form version ${versionNumber} was not found`,
      });
    }

    form.published_version = versionNumber;
    form.status = 'active';
    form.updated_at = new Date().toISOString();
    return form;
  }

  getCompiledSchema(id: string) {
    const form = this.getById(id);
    const version = this.getPublishedVersion(form);

    return {
      form: {
        id: form.id,
        name: form.name,
        workspace_id: form.workspace_id,
        version: version.version,
      },
      fields: version.schema_json.fields,
      condition_groups: version.schema_json.condition_groups,
      redirects: version.schema_json.redirects,
    };
  }

  getPublishedVersion(form: FormRecord) {
    if (!form.published_version) {
      throw new BadRequestException({
        code: 'FORM_NOT_PUBLISHED',
        message: 'Form does not have a published version',
      });
    }

    const version = form.versions.find(
      (entry) => entry.version === form.published_version,
    );

    if (!version) {
      throw new NotFoundException({
        code: 'VERSION_NOT_FOUND',
        message: 'Published version could not be resolved',
      });
    }

    return version;
  }

  getById(id: string) {
    const form = this.store.forms.find((entry) => entry.id === id);
    if (!form) {
      throw new NotFoundException({
        code: 'FORM_NOT_FOUND',
        message: `Form ${id} was not found`,
      });
    }

    return form;
  }

  private assertUniqueFieldKeys(fields: FormField[]) {
    const keys = new Set<string>();
    for (const field of fields) {
      if (keys.has(field.key)) {
        throw new BadRequestException({
          code: 'DUPLICATE_FIELD_KEY',
          message: `Field key ${field.key} is duplicated`,
        });
      }
      keys.add(field.key);
    }
  }

  private assertNoConditionCycles(fields: FormField[], groups: ConditionGroup[]) {
    const fieldKeys = new Set(fields.map((field) => field.key));
    const graph = new Map<string, Set<string>>();

    for (const fieldKey of fieldKeys) {
      graph.set(fieldKey, new Set());
    }

    for (const group of groups) {
      if (!fieldKeys.has(group.field_key)) {
        throw new BadRequestException({
          code: 'UNKNOWN_FIELD_REFERENCE',
          message: `Condition group targets unknown field ${group.field_key}`,
        });
      }

      for (const condition of group.conditions) {
        if (!fieldKeys.has(condition.if_field_key)) {
          throw new BadRequestException({
            code: 'UNKNOWN_FIELD_REFERENCE',
            message: `Condition references unknown field ${condition.if_field_key}`,
          });
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
      for (const neighbor of graph.get(node) ?? []) {
        if (dfs(neighbor)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (dfs(node)) {
        throw new BadRequestException({
          code: 'FIELD_CONDITION_CYCLE',
          message: 'Field conditions contain a dependency cycle',
        });
      }
    }
  }

  evaluateConditionGroups(
    values: Record<string, unknown>,
    groups: ConditionGroup[],
    fieldKey: string,
    effect: ConditionEffect,
  ) {
    const relevantGroups = groups.filter(
      (group) => group.field_key === fieldKey && group.effect === effect,
    );

    return relevantGroups.some((group) => {
      const checks = group.conditions.map((condition) => {
        const left = values[condition.if_field_key];
        const right = this.parseConditionValue(condition.value);
        switch (condition.operator) {
          case 'eq':
            return left === right;
          case 'neq':
            return left !== right;
          case 'gt':
            return Number(left) > Number(right);
          case 'gte':
            return Number(left) >= Number(right);
          case 'lt':
            return Number(left) < Number(right);
          case 'lte':
            return Number(left) <= Number(right);
          case 'contains':
            return Array.isArray(left)
              ? left.includes(right as never)
              : String(left ?? '').includes(String(right));
          case 'in': {
            const parsed = Array.isArray(right) ? right : [];
            return parsed.includes(left as never);
          }
          default:
            return false;
        }
      });

      return group.operator === 'AND'
        ? checks.every(Boolean)
        : checks.some(Boolean);
    });
  }

  private parseConditionValue(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
