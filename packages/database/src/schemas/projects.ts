import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

export type ProjectStatus = 'active' | 'archived';
export type TaskStatus = 'active' | 'archived';

export const clients = pgTable(
  'clients',
  {
    id: generateEntityId('cli'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }),
    address: text('address'),
    notes: text('notes'),
    ...generateTimestamps(),
  },
  (table) => [
    index('clients_workspace_id_idx').on(table.workspaceId),
    index('clients_workspace_id_deleted_at_idx').on(table.workspaceId, table.deletedAt),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: generateEntityId('prj'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    code: varchar('code', { length: 64 }),
    color: varchar('color', { length: 7 }),
    status: text('status').$type<ProjectStatus>().notNull().default('active'),
    billable: boolean('billable').notNull().default(true),
    notes: text('notes'),
    budgetMinutes: integer('budget_minutes'),
    budgetAmountMinor: integer('budget_amount_minor'),
    budgetCurrency: varchar('budget_currency', { length: 3 }),
    budgetAlertAtPercent: integer('budget_alert_at_percent').notNull().default(80),
    ...generateTimestamps(),
  },
  (table) => [
    index('projects_workspace_id_idx').on(table.workspaceId),
    index('projects_workspace_id_status_idx').on(table.workspaceId, table.status),
    index('projects_workspace_id_client_id_idx').on(table.workspaceId, table.clientId),
    uniqueIndex('projects_workspace_id_code_unique')
      .on(table.workspaceId, table.code)
      .where(sql`${table.deletedAt} is null and ${table.code} is not null`),
    check(
      'projects_budget_minutes_nonnegative_check',
      sql`${table.budgetMinutes} is null or ${table.budgetMinutes} > 0`,
    ),
    check(
      'projects_budget_amount_nonnegative_check',
      sql`${table.budgetAmountMinor} is null or ${table.budgetAmountMinor} >= 0`,
    ),
    check(
      'projects_budget_currency_with_amount_check',
      sql`(${table.budgetAmountMinor} is null and ${table.budgetCurrency} is null) or (${table.budgetAmountMinor} is not null and ${table.budgetCurrency} is not null)`,
    ),
    check(
      'projects_budget_alert_percent_check',
      sql`${table.budgetAlertAtPercent} > 0 and ${table.budgetAlertAtPercent} <= 100`,
    ),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: generateEntityId('tsk'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    status: text('status').$type<TaskStatus>().notNull().default('active'),
    estimateMinutes: integer('estimate_minutes'),
    ...generateTimestamps(),
  },
  (table) => [
    index('tasks_workspace_id_idx').on(table.workspaceId),
    index('tasks_workspace_id_project_id_idx').on(table.workspaceId, table.projectId),
    uniqueIndex('tasks_project_id_name_unique')
      .on(table.projectId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
