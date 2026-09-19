import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { tags, timeEntryTags } from '../src/schemas/tags.ts';

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

describe('tags schema tables', () => {
  it('uses plural snake_case table names', () => {
    expect(getTableConfig(tags).name).toBe('tags');
    expect(getTableConfig(timeEntryTags).name).toBe('time_entry_tags');
  });

  it('requires workspace_id on both tables', () => {
    for (const table of [tags, timeEntryTags]) {
      const workspaceId = requireColumn(getTableConfig(table).columns, 'workspace_id');
      expect(workspaceId.notNull).toBe(true);
    }
  });

  it('gives tags a text primary key and short name', () => {
    const id = requireColumn(getTableConfig(tags).columns, 'id');
    expect(id.columnType).toBe('PgText');
    expect(id.primary).toBe(true);
    const name = requireColumn(getTableConfig(tags).columns, 'name');
    expect(name.notNull).toBe(true);
  });

  it('indexes workspace lookups', () => {
    expect(hasIndex(tags, 'tags_workspace_id_idx', false)).toBe(true);
    expect(hasIndex(timeEntryTags, 'time_entry_tags_workspace_id_tag_id_idx', false)).toBe(true);
    expect(hasIndex(timeEntryTags, 'time_entry_tags_workspace_id_time_entry_id_idx', false)).toBe(
      true,
    );
  });

  it('enforces unique active tag names per workspace', () => {
    expect(hasIndex(tags, 'tags_workspace_id_name_unique', true)).toBe(true);
  });

  it('uses a composite primary key on the join table', () => {
    const config = getTableConfig(timeEntryTags);
    const primaryKeyColumns = config.primaryKeys.map((key) =>
      key.columns.map((column) => column.name),
    );
    expect(primaryKeyColumns).toEqual([['time_entry_id', 'tag_id']]);
  });

  it('cascades join rows when a tag or time entry is deleted', () => {
    const foreignKeys = getTableConfig(timeEntryTags).foreignKeys;
    expect(foreignKeys.filter((fk) => fk.onDelete === 'cascade').length).toBeGreaterThan(1);
  });
});
