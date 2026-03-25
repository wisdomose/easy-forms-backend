import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  workosSubject: text('workos_subject').notNull().unique(),
  email: text('email'),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceUserUnique: unique().on(table.workspaceId, table.userId),
  }),
);

export const forms = pgTable('forms', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull(),
  publishedVersion: integer('published_version'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const formVersions = pgTable(
  'form_versions',
  {
    id: uuid('id').primaryKey(),
    formId: uuid('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    schemaJson: jsonb('schema_json').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    formVersionUnique: unique().on(table.formId, table.version),
  }),
);

export const formEvents = pgTable('form_events', {
  id: uuid('id').primaryKey(),
  formId: uuid('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(),
  eventDate: date('event_date').notNull(),
  metadataJson: jsonb('metadata_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
