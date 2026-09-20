import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';

export type TimesheetStatus = 'submitted' | 'approved' | 'rejected';

/** One approval row per member per week. Absence means draft (editable). */
export const timesheets = pgTable(
  'timesheets',
  {
    id: generateEntityId('ts'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Monday calendar date. */
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    status: text('status').$type<TimesheetStatus>().notNull(),
    submittedAt: timestamp('submitted_at', TIMESTAMP_CONFIG),
    submitNote: varchar('submit_note', { length: 2000 }),
    decidedAt: timestamp('decided_at', TIMESTAMP_CONFIG),
    decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decisionNote: varchar('decision_note', { length: 2000 }),
    /** Set when approved; mirrors time_entries.locked_at for the week. */
    lockedAt: timestamp('locked_at', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('timesheets_workspace_id_idx').on(table.workspaceId),
    index('timesheets_workspace_id_status_idx').on(table.workspaceId, table.status),
    index('timesheets_workspace_id_user_id_week_start_idx').on(
      table.workspaceId,
      table.userId,
      table.weekStart,
    ),
    uniqueIndex('timesheets_workspace_user_week_unique').on(
      table.workspaceId,
      table.userId,
      table.weekStart,
    ),
    check(
      'timesheets_week_start_monday_check',
      sql`extract(dow from ${table.weekStart}::date) = 1`,
    ),
    check(
      'timesheets_approved_requires_lock_check',
      sql`(${table.status} = 'approved' and ${table.lockedAt} is not null and ${table.decidedAt} is not null) or (${table.status} <> 'approved')`,
    ),
  ],
);

export type Timesheet = typeof timesheets.$inferSelect;
export type NewTimesheet = typeof timesheets.$inferInsert;
