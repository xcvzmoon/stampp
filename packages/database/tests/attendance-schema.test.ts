import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { attendanceRecords } from '../src/schemas/attendance.ts';

type TableColumn = ReturnType<typeof getTableConfig>['columns'][number];

function requireColumn(columns: TableColumn[], name: string): TableColumn {
  const found = columns.find((column) => column.name === name);
  if (!found) {
    throw new Error(`missing column ${name}`);
  }
  return found;
}

function hasIndex(table: AnyPgTable, indexName: string, unique: boolean): boolean {
  return getTableConfig(table).indexes.some(
    (entry) => entry.config.name === indexName && entry.config.unique === unique,
  );
}

describe('attendance schema', () => {
  it('uses plural snake_case table name', () => {
    expect(getTableConfig(attendanceRecords).name).toBe('attendance_records');
  });

  it('requires workspace, user, clock-in, work date, and timezone', () => {
    const columns = getTableConfig(attendanceRecords).columns;
    expect(requireColumn(columns, 'workspace_id').notNull).toBe(true);
    expect(requireColumn(columns, 'user_id').notNull).toBe(true);
    expect(requireColumn(columns, 'clock_in_at').notNull).toBe(true);
    expect(requireColumn(columns, 'clock_out_at').notNull).toBe(false);
    expect(requireColumn(columns, 'duration_minutes').notNull).toBe(false);
    expect(requireColumn(columns, 'work_date').notNull).toBe(true);
    expect(requireColumn(columns, 'timezone').notNull).toBe(true);
    expect(requireColumn(columns, 'source').notNull).toBe(true);
  });

  it('allows one open punch per workspace member', () => {
    expect(hasIndex(attendanceRecords, 'attendance_records_one_open_per_user_unique', true)).toBe(
      true,
    );
  });

  it('indexes workspace and work-date listings', () => {
    expect(hasIndex(attendanceRecords, 'attendance_records_workspace_id_idx', false)).toBe(true);
    expect(
      hasIndex(attendanceRecords, 'attendance_records_workspace_id_user_id_clock_in_at_idx', false),
    ).toBe(true);
    expect(
      hasIndex(attendanceRecords, 'attendance_records_workspace_id_work_date_idx', false),
    ).toBe(true);
  });
});
