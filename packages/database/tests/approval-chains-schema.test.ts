import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { approvalChains, approvalDecisions, approvalRuns } from '../src/schemas/approvalChains.ts';

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

describe('approval chain schema', () => {
  it('uses plural snake_case table names', () => {
    expect(getTableConfig(approvalChains).name).toBe('approval_chains');
    expect(getTableConfig(approvalRuns).name).toBe('approval_runs');
    expect(getTableConfig(approvalDecisions).name).toBe('approval_decisions');
  });

  it('stores ordered chain steps as jsonb', () => {
    const columns = getTableConfig(approvalChains).columns;
    expect(requireColumn(columns, 'steps').notNull).toBe(true);
    expect(requireColumn(columns, 'entity_type').notNull).toBe(true);
    expect(requireColumn(columns, 'active').notNull).toBe(true);
    expect(hasIndex(approvalChains, 'approval_chains_workspace_name_unique', true)).toBe(true);
  });

  it('allows one pending run per entity and tracks current step', () => {
    const columns = getTableConfig(approvalRuns).columns;
    expect(requireColumn(columns, 'current_step').notNull).toBe(true);
    expect(requireColumn(columns, 'step_count').notNull).toBe(true);
    expect(hasIndex(approvalRuns, 'approval_runs_open_entity_unique', true)).toBe(true);
    expect(hasIndex(approvalRuns, 'approval_runs_workspace_id_status_idx', false)).toBe(true);
  });

  it('records one decision per run step', () => {
    expect(hasIndex(approvalDecisions, 'approval_decisions_run_step_unique', true)).toBe(true);
    expect(requireColumn(getTableConfig(approvalDecisions).columns, 'action').notNull).toBe(true);
  });
});
