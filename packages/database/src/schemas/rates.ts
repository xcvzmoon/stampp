import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';
import { projects, tasks } from './projects.ts';

export type RateKind = 'billable' | 'cost';
export type RateScope = 'org' | 'user' | 'project' | 'user_project' | 'task';

/**
 * Versioned rate rows. Never rewrite closed history: start a new row with a
 * later `effective_from` (or revoke by setting `effective_to`).
 */
export const rates = pgTable(
  'rates',
  {
    id: generateEntityId('rate'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<RateKind>().notNull(),
    scope: text('scope').$type<RateScope>().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    amountMinor: integer('amount_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    effectiveFrom: timestamp('effective_from', TIMESTAMP_CONFIG).notNull(),
    /** Null means the version is still open. */
    effectiveTo: timestamp('effective_to', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('rates_workspace_id_idx').on(table.workspaceId),
    index('rates_workspace_id_kind_effective_from_idx').on(
      table.workspaceId,
      table.kind,
      table.effectiveFrom,
    ),
    index('rates_workspace_id_project_id_idx').on(table.workspaceId, table.projectId),
    index('rates_workspace_id_user_id_idx').on(table.workspaceId, table.userId),
    uniqueIndex('rates_open_org_unique')
      .on(table.workspaceId, table.kind)
      .where(sql`${table.scope} = 'org' and ${table.effectiveTo} is null`),
    uniqueIndex('rates_open_user_unique')
      .on(table.workspaceId, table.kind, table.userId)
      .where(sql`${table.scope} = 'user' and ${table.effectiveTo} is null`),
    uniqueIndex('rates_open_project_unique')
      .on(table.workspaceId, table.kind, table.projectId)
      .where(sql`${table.scope} = 'project' and ${table.effectiveTo} is null`),
    uniqueIndex('rates_open_user_project_unique')
      .on(table.workspaceId, table.kind, table.userId, table.projectId)
      .where(sql`${table.scope} = 'user_project' and ${table.effectiveTo} is null`),
    uniqueIndex('rates_open_task_unique')
      .on(table.workspaceId, table.kind, table.taskId)
      .where(sql`${table.scope} = 'task' and ${table.effectiveTo} is null`),
    check('rates_amount_minor_nonnegative_check', sql`${table.amountMinor} >= 0`),
    check(
      'rates_scope_targets_check',
      sql`((${table.scope} = 'org' and ${table.userId} is null and ${table.projectId} is null and ${table.taskId} is null) or (${table.scope} = 'user' and ${table.userId} is not null and ${table.projectId} is null and ${table.taskId} is null) or (${table.scope} = 'project' and ${table.userId} is null and ${table.projectId} is not null and ${table.taskId} is null) or (${table.scope} = 'user_project' and ${table.userId} is not null and ${table.projectId} is not null and ${table.taskId} is null) or (${table.scope} = 'task' and ${table.userId} is null and ${table.projectId} is not null and ${table.taskId} is not null))`,
    ),
    check(
      'rates_effective_window_check',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

export type Rate = typeof rates.$inferSelect;
export type NewRate = typeof rates.$inferInsert;
