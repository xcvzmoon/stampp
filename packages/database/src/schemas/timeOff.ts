import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps, TIMESTAMP_CONFIG } from './_helpers.ts';
import { organizations, users } from './auth.ts';

export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'canceled';

/** Workspace time-off category with optional annual allowance. */
export const timeOffTypes = pgTable(
  'time_off_types',
  {
    id: generateEntityId('tot'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    color: varchar('color', { length: 7 }),
    paid: boolean('paid').notNull().default(true),
    /** null means no balance ceiling (unlimited / unpaid tracking). */
    annualAllowanceDays: numeric('annual_allowance_days', { precision: 5, scale: 2 }),
    requiresApproval: boolean('requires_approval').notNull().default(true),
    active: boolean('active').notNull().default(true),
    ...generateTimestamps(),
  },
  (table) => [
    index('time_off_types_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('time_off_types_workspace_name_unique').on(table.workspaceId, table.name),
    check(
      'time_off_types_allowance_non_negative_check',
      sql`${table.annualAllowanceDays} is null or ${table.annualAllowanceDays} >= 0`,
    ),
  ],
);

export const holidays = pgTable(
  'holidays',
  {
    id: generateEntityId('hol'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    ...generateTimestamps(),
  },
  (table) => [
    index('holidays_workspace_id_idx').on(table.workspaceId),
    index('holidays_workspace_id_date_idx').on(table.workspaceId, table.date),
    uniqueIndex('holidays_workspace_name_date_unique').on(
      table.workspaceId,
      table.name,
      table.date,
    ),
  ],
);

export const timeOffRequests = pgTable(
  'time_off_requests',
  {
    id: generateEntityId('tor'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    timeOffTypeId: text('time_off_type_id')
      .notNull()
      .references(() => timeOffTypes.id, { onDelete: 'restrict' }),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    /** Business days excluding weekends and holidays at create/decision time. */
    days: numeric('days', { precision: 5, scale: 2 }).notNull(),
    status: text('status').$type<TimeOffStatus>().notNull().default('pending'),
    note: varchar('note', { length: 2000 }),
    decidedAt: timestamp('decided_at', TIMESTAMP_CONFIG),
    decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decisionNote: varchar('decision_note', { length: 2000 }),
    ...generateTimestamps(),
  },
  (table) => [
    index('time_off_requests_workspace_id_idx').on(table.workspaceId),
    index('time_off_requests_workspace_id_status_idx').on(table.workspaceId, table.status),
    index('time_off_requests_workspace_id_user_id_start_date_idx').on(
      table.workspaceId,
      table.userId,
      table.startDate,
    ),
    index('time_off_requests_workspace_id_type_id_idx').on(table.workspaceId, table.timeOffTypeId),
    check('time_off_requests_range_check', sql`${table.endDate} >= ${table.startDate}`),
    check('time_off_requests_days_positive_check', sql`(${table.days}) > 0`),
    check(
      'time_off_requests_decided_requires_fields_check',
      sql`(${table.status} in ('pending', 'canceled')) or (${table.status} in ('approved', 'rejected') and ${table.decidedAt} is not null)`,
    ),
  ],
);

export type TimeOffType = typeof timeOffTypes.$inferSelect;
export type NewTimeOffType = typeof timeOffTypes.$inferInsert;
export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;
export type NewTimeOffRequest = typeof timeOffRequests.$inferInsert;
