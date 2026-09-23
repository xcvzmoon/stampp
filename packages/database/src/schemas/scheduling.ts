import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';
import { projects } from './projects.ts';

/** One weekly working capacity row per member per workspace. */
export const memberCapacities = pgTable(
  'member_capacities',
  {
    id: generateEntityId('mcap'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weeklyHours: numeric('weekly_hours', { precision: 5, scale: 2 }).notNull(),
    note: varchar('note', { length: 500 }),
    ...generateTimestamps(),
  },
  (table) => [
    index('member_capacities_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('member_capacities_workspace_user_unique').on(table.workspaceId, table.userId),
    check('member_capacities_weekly_hours_positive_check', sql`${table.weeklyHours} > 0`),
  ],
);

/**
 * Project assignment with constant weekly allocation over an inclusive date range.
 * Scheduled hours are compared to capacity for overbooking detection.
 */
export const projectAssignments = pgTable(
  'project_assignments',
  {
    id: generateEntityId('pas'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    hoursPerWeek: numeric('hours_per_week', { precision: 5, scale: 2 }).notNull(),
    note: varchar('note', { length: 500 }),
    active: boolean('active').notNull().default(true),
    ...generateTimestamps(),
  },
  (table) => [
    index('project_assignments_workspace_id_idx').on(table.workspaceId),
    index('project_assignments_workspace_id_user_id_start_date_idx').on(
      table.workspaceId,
      table.userId,
      table.startDate,
    ),
    index('project_assignments_workspace_id_project_id_idx').on(table.workspaceId, table.projectId),
    index('project_assignments_workspace_id_active_idx').on(table.workspaceId, table.active),
    check('project_assignments_range_check', sql`${table.endDate} >= ${table.startDate}`),
    check('project_assignments_hours_positive_check', sql`${table.hoursPerWeek} > 0`),
  ],
);

export type MemberCapacity = typeof memberCapacities.$inferSelect;
export type NewMemberCapacity = typeof memberCapacities.$inferInsert;
export type ProjectAssignment = typeof projectAssignments.$inferSelect;
export type NewProjectAssignment = typeof projectAssignments.$inferInsert;
