import { sql } from 'drizzle-orm';
import {
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
import { kioskDevices } from './kiosk.ts';

export type AttendanceSource = 'clock' | 'manual' | 'kiosk';

/**
 * Attendance punch pair: clock-in starts a row; clock-out closes it.
 * Separate from project time (time_entries).
 */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: generateEntityId('at'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    clockInAt: timestamp('clock_in_at', TIMESTAMP_CONFIG).notNull(),
    clockOutAt: timestamp('clock_out_at', TIMESTAMP_CONFIG),
    /** Elapsed minutes stored on close; null while the punch is open. */
    durationMinutes: integer('duration_minutes'),
    /** Calendar date of clock-in in the member timezone. */
    workDate: date('work_date', { mode: 'string' }).notNull(),
    timezone: varchar('timezone', { length: 100 }).notNull(),
    source: text('source').$type<AttendanceSource>().notNull().default('clock'),
    /** Set when punched from a registered kiosk device. */
    kioskDeviceId: text('kiosk_device_id').references(() => kioskDevices.id, {
      onDelete: 'set null',
    }),
    note: varchar('note', { length: 500 }),
    ...generateTimestamps(),
  },
  (table) => [
    index('attendance_records_workspace_id_idx').on(table.workspaceId),
    index('attendance_records_workspace_id_user_id_clock_in_at_idx').on(
      table.workspaceId,
      table.userId,
      table.clockInAt,
    ),
    index('attendance_records_workspace_id_work_date_idx').on(table.workspaceId, table.workDate),
    uniqueIndex('attendance_records_one_open_per_user_unique')
      .on(table.workspaceId, table.userId)
      .where(sql`${table.clockOutAt} is null`),
    check(
      'attendance_records_interval_check',
      sql`(${table.clockOutAt} is null and ${table.durationMinutes} is null) or (${table.clockOutAt} is not null and ${table.clockOutAt} > ${table.clockInAt} and ${table.durationMinutes} is not null and ${table.durationMinutes} >= 0)`,
    ),
  ],
);

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
