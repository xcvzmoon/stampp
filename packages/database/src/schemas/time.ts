import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
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

/** A recorded block of work, stored as either an interval or a fixed duration. */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: generateEntityId('te'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'restrict' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'restrict' }),
    description: varchar('description', { length: 1000 }).notNull().default(''),
    billable: boolean('billable').notNull().default(true),
    startAt: timestamp('start_at', TIMESTAMP_CONFIG),
    endAt: timestamp('end_at', TIMESTAMP_CONFIG),
    durationMinutes: integer('duration_minutes'),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    timezone: varchar('timezone', { length: 100 }).notNull(),
    /** Set when an approval or manager lock makes the entry immutable. */
    lockedAt: timestamp('locked_at', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('time_entries_workspace_id_user_id_start_at_idx').on(
      table.workspaceId,
      table.userId,
      table.startAt,
    ),
    index('time_entries_workspace_id_project_id_start_at_idx').on(
      table.workspaceId,
      table.projectId,
      table.startAt,
    ),
    index('time_entries_workspace_id_user_id_work_date_idx').on(
      table.workspaceId,
      table.userId,
      table.workDate,
    ),
    uniqueIndex('time_entries_one_running_per_user_unique')
      .on(table.workspaceId, table.userId)
      .where(sql`${table.startAt} is not null and ${table.endAt} is null`),
    check(
      'time_entries_interval_or_duration_check',
      sql`((${table.startAt} is not null and ${table.durationMinutes} is null and (${table.endAt} is null or ${table.endAt} > ${table.startAt})) or (${table.startAt} is null and ${table.endAt} is null and ${table.durationMinutes} > 0))`,
    ),
    check(
      'time_entries_task_requires_project_check',
      sql`${table.taskId} is null or ${table.projectId} is not null`,
    ),
  ],
);

/** Persisted time-entry row. */
export type TimeEntry = typeof timeEntries.$inferSelect;

/** Values accepted when inserting a time entry. */
export type NewTimeEntry = typeof timeEntries.$inferInsert;
