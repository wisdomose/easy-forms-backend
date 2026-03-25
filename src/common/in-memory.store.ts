import { Injectable } from '@nestjs/common';

export type Workspace = {
  id: string;
  name: string;
  created_at: string;
};

export type FormStatus = 'draft' | 'active' | 'archived';
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multiselect'
  | 'file';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in';

export type ConditionEffect = 'show' | 'hide' | 'require';

export type FormField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  validations?: Array<{ type: string; value: string | number | boolean }>;
};

export type ConditionGroup = {
  id: string;
  field_key: string;
  effect: ConditionEffect;
  operator: 'AND' | 'OR';
  conditions: Array<{
    id: string;
    if_field_key: string;
    operator: ConditionOperator;
    value: string;
  }>;
};

export type RedirectRule = {
  id: string;
  position: number;
  url: string;
  condition_group_id?: string;
};

export type FormVersion = {
  id: string;
  version: number;
  created_at: string;
  schema_json: {
    fields: FormField[];
    condition_groups: ConditionGroup[];
    redirects: RedirectRule[];
  };
};

export type FormRecord = {
  id: string;
  workspace_id: string;
  name: string;
  status: FormStatus;
  created_at: string;
  updated_at: string;
  published_version: number | null;
  versions: FormVersion[];
};

export type SubmissionValue = string | number | boolean | string[] | null;

export type SubmissionRecord = {
  id: string;
  form_id: string;
  version: number;
  created_at: string;
  values: Record<string, SubmissionValue>;
};

@Injectable()
export class InMemoryStore {
  workspaces: Workspace[] = [];
  forms: FormRecord[] = [];
  submissions: SubmissionRecord[] = [];
}
