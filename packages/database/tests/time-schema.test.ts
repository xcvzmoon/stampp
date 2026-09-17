import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { timeEntries } from '../src/schemas/time.ts';

type TableColumn = ReturnType<typeof getTableConfig>['columns'][number];

function requireColumn(name: string): TableColumn {
  const column = getTableConfig(timeEntries).columns.find((entry) => entry.name === name);
  if (!column) throw new Error(`missing column ${name}`);
  return column;
}

function hasIndex(table: AnyPgTable, name: string, unique: boolean): boolean {
  return getTableConfig(table).indexes.some(
    (entry) => entry.config.name === name && entry.config.unique === unique,
  );
}

describe('time entries schema', () => {
  it('stores workspace and actor ownership as required fields', () => {
    expect(getTableConfig(timeEntries).name).toBe('time_entries');
    expect(requireColumn('workspace_id').notNull).toBe(true);
    expect(requireColumn('user_id').notNull).toBe(true);
  });

  it('stores interval and duration fields independently', () => {
    expect(requireColumn('start_at').columnType).toBe('PgTimestamp');
    expect(requireColumn('end_at').columnType).toBe('PgTimestamp');
    expect(requireColumn('duration_minutes').columnType).toBe('PgInteger');
  });

  it('requires a timezone snapshot', () => {
    expect(requireColumn('timezone').notNull).toBe(true);
    expect(requireColumn('work_date').notNull).toBe(true);
  });

  it('declares representation and assignment checks', () => {
    const names = getTableConfig(timeEntries).checks.map((entry) => entry.name);
    expect(names).toContain('time_entries_interval_or_duration_check');
    expect(names).toContain('time_entries_task_requires_project_check');
  });

  it('prevents more than one running timer per user and workspace', () => {
    expect(hasIndex(timeEntries, 'time_entries_one_running_per_user_unique', true)).toBe(true);
  });

  it('indexes tenant-scoped history and project queries', () => {
    expect(hasIndex(timeEntries, 'time_entries_workspace_id_user_id_start_at_idx', false)).toBe(
      true,
    );
    expect(hasIndex(timeEntries, 'time_entries_workspace_id_project_id_start_at_idx', false)).toBe(
      true,
    );
    expect(hasIndex(timeEntries, 'time_entries_workspace_id_user_id_work_date_idx', false)).toBe(
      true,
    );
  });
});
