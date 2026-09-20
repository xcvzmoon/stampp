import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { rates } from '../src/schemas/rates.ts';

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

describe('rates schema', () => {
  it('uses plural snake_case table name', () => {
    expect(getTableConfig(rates).name).toBe('rates');
  });

  it('requires workspace_id and money columns', () => {
    const columns = getTableConfig(rates).columns;
    expect(requireColumn(columns, 'workspace_id').notNull).toBe(true);
    expect(requireColumn(columns, 'kind').notNull).toBe(true);
    expect(requireColumn(columns, 'scope').notNull).toBe(true);
    expect(requireColumn(columns, 'amount_minor').notNull).toBe(true);
    expect(requireColumn(columns, 'currency').notNull).toBe(true);
    expect(requireColumn(columns, 'effective_from').notNull).toBe(true);
    expect(requireColumn(columns, 'effective_to').notNull).toBe(false);
  });

  it('gives rates a prefixed text primary key', () => {
    const id = requireColumn(getTableConfig(rates).columns, 'id');
    expect(id.columnType).toBe('PgText');
    expect(id.primary).toBe(true);
  });

  it('indexes workspace and as-of lookups', () => {
    expect(hasIndex(rates, 'rates_workspace_id_idx', false)).toBe(true);
    expect(hasIndex(rates, 'rates_workspace_id_kind_effective_from_idx', false)).toBe(true);
    expect(hasIndex(rates, 'rates_open_org_unique', true)).toBe(true);
    expect(hasIndex(rates, 'rates_open_user_unique', true)).toBe(true);
    expect(hasIndex(rates, 'rates_open_project_unique', true)).toBe(true);
    expect(hasIndex(rates, 'rates_open_user_project_unique', true)).toBe(true);
    expect(hasIndex(rates, 'rates_open_task_unique', true)).toBe(true);
  });

  it('cascades when the workspace is deleted', () => {
    const foreignKeys = getTableConfig(rates).foreignKeys;
    expect(foreignKeys.some((fk) => fk.onDelete === 'cascade')).toBe(true);
  });
});
