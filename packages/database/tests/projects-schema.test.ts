import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { clients, projects, tasks } from '../src/schemas/projects.ts';

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

describe('projects schema tables', () => {
  it('uses plural snake_case table names', () => {
    expect(getTableConfig(clients).name).toBe('clients');
    expect(getTableConfig(projects).name).toBe('projects');
    expect(getTableConfig(tasks).name).toBe('tasks');
  });

  it('gives every product table a text primary key', () => {
    for (const table of [clients, projects, tasks]) {
      const id = requireColumn(getTableConfig(table).columns, 'id');
      expect(id.columnType).toBe('PgText');
      expect(id.primary).toBe(true);
    }
  });

  it('requires workspace_id on every product table', () => {
    for (const table of [clients, projects, tasks]) {
      const workspaceId = requireColumn(getTableConfig(table).columns, 'workspace_id');
      expect(workspaceId.notNull).toBe(true);
    }
  });

  it('indexes workspace_id lookups', () => {
    expect(hasIndex(clients, 'clients_workspace_id_idx', false)).toBe(true);
    expect(hasIndex(projects, 'projects_workspace_id_idx', false)).toBe(true);
    expect(hasIndex(tasks, 'tasks_workspace_id_idx', false)).toBe(true);
  });

  it('enforces unique active project codes per workspace', () => {
    expect(hasIndex(projects, 'projects_workspace_id_code_unique', true)).toBe(true);
  });

  it('enforces unique active task names per project', () => {
    expect(hasIndex(tasks, 'tasks_project_id_name_unique', true)).toBe(true);
  });

  it('defaults projects to active and billable', () => {
    const status = requireColumn(getTableConfig(projects).columns, 'status');
    const billable = requireColumn(getTableConfig(projects).columns, 'billable');
    expect(status.default).toBe('active');
    expect(billable.default).toBe(true);
  });

  it('stores estimate minutes as integer on tasks', () => {
    const estimate = requireColumn(getTableConfig(tasks).columns, 'estimate_minutes');
    expect(estimate.columnType).toBe('PgInteger');
    expect(estimate.notNull).toBe(false);
  });

  it('cascades tasks when a project is deleted', () => {
    const taskFks = getTableConfig(tasks).foreignKeys;
    expect(taskFks.some((fk) => fk.onDelete === 'cascade')).toBe(true);
  });

  it('nulls project client when a client is deleted', () => {
    const projectFks = getTableConfig(projects).foreignKeys;
    const clientFk = projectFks.find((fk) => fk.onDelete === 'set null');
    expect(clientFk).toBeDefined();
  });
});
