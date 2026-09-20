import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { timesheets } from '../src/schemas/timesheets.ts';

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

describe('timesheets schema', () => {
  it('uses plural snake_case table name', () => {
    expect(getTableConfig(timesheets).name).toBe('timesheets');
  });

  it('requires workspace, user, week, and status', () => {
    const columns = getTableConfig(timesheets).columns;
    expect(requireColumn(columns, 'workspace_id').notNull).toBe(true);
    expect(requireColumn(columns, 'user_id').notNull).toBe(true);
    expect(requireColumn(columns, 'week_start').notNull).toBe(true);
    expect(requireColumn(columns, 'status').notNull).toBe(true);
    expect(requireColumn(columns, 'locked_at').notNull).toBe(false);
  });

  it('enforces one row per workspace, user, and week', () => {
    expect(hasIndex(timesheets, 'timesheets_workspace_user_week_unique', true)).toBe(true);
  });

  it('indexes workspace status queues', () => {
    expect(hasIndex(timesheets, 'timesheets_workspace_id_idx', false)).toBe(true);
    expect(hasIndex(timesheets, 'timesheets_workspace_id_status_idx', false)).toBe(true);
  });
});
