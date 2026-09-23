import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { holidays, timeOffRequests, timeOffTypes } from '../src/schemas/timeOff.ts';

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

describe('time-off schema', () => {
  it('uses plural snake_case table names', () => {
    expect(getTableConfig(timeOffTypes).name).toBe('time_off_types');
    expect(getTableConfig(holidays).name).toBe('holidays');
    expect(getTableConfig(timeOffRequests).name).toBe('time_off_requests');
  });

  it('requires workspace, name, and allowance on types', () => {
    const columns = getTableConfig(timeOffTypes).columns;
    expect(requireColumn(columns, 'workspace_id').notNull).toBe(true);
    expect(requireColumn(columns, 'name').notNull).toBe(true);
    expect(requireColumn(columns, 'paid').notNull).toBe(true);
    expect(requireColumn(columns, 'requires_approval').notNull).toBe(true);
    expect(requireColumn(columns, 'active').notNull).toBe(true);
    expect(requireColumn(columns, 'annual_allowance_days').notNull).toBe(false);
  });

  it('enforces unique type names per workspace', () => {
    expect(hasIndex(timeOffTypes, 'time_off_types_workspace_name_unique', true)).toBe(true);
  });

  it('indexes holidays by workspace date and unique name+date', () => {
    expect(hasIndex(holidays, 'holidays_workspace_id_date_idx', false)).toBe(true);
    expect(hasIndex(holidays, 'holidays_workspace_name_date_unique', true)).toBe(true);
  });

  it('indexes requests by status and member range', () => {
    expect(hasIndex(timeOffRequests, 'time_off_requests_workspace_id_status_idx', false)).toBe(
      true,
    );
    expect(
      hasIndex(timeOffRequests, 'time_off_requests_workspace_id_user_id_start_date_idx', false),
    ).toBe(true);
    expect(requireColumn(getTableConfig(timeOffRequests).columns, 'days').notNull).toBe(true);
    expect(requireColumn(getTableConfig(timeOffRequests).columns, 'status').notNull).toBe(true);
  });
});
