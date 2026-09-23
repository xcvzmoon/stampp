import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { memberCapacities, projectAssignments } from '../src/schemas/scheduling.ts';

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

describe('scheduling schema', () => {
  it('uses plural snake_case table names', () => {
    expect(getTableConfig(memberCapacities).name).toBe('member_capacities');
    expect(getTableConfig(projectAssignments).name).toBe('project_assignments');
  });

  it('requires workspace, user, and weekly hours on capacity', () => {
    const columns = getTableConfig(memberCapacities).columns;
    expect(requireColumn(columns, 'workspace_id').notNull).toBe(true);
    expect(requireColumn(columns, 'user_id').notNull).toBe(true);
    expect(requireColumn(columns, 'weekly_hours').notNull).toBe(true);
    expect(requireColumn(columns, 'note').notNull).toBe(false);
  });

  it('enforces one capacity row per workspace member', () => {
    expect(hasIndex(memberCapacities, 'member_capacities_workspace_user_unique', true)).toBe(true);
  });

  it('indexes assignments by member range and project', () => {
    expect(
      hasIndex(
        projectAssignments,
        'project_assignments_workspace_id_user_id_start_date_idx',
        false,
      ),
    ).toBe(true);
    expect(
      hasIndex(projectAssignments, 'project_assignments_workspace_id_project_id_idx', false),
    ).toBe(true);
    expect(
      requireColumn(getTableConfig(projectAssignments).columns, 'hours_per_week').notNull,
    ).toBe(true);
    expect(requireColumn(getTableConfig(projectAssignments).columns, 'active').notNull).toBe(true);
  });
});
