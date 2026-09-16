import { getTableConfig, pgTable, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import {
  TIMESTAMP_CONFIG,
  generateAuthTimestamps,
  generateTextId,
  generateTimestamps,
  generateTimestampsWithAudit,
  generateUuid,
  generateUuidColumn,
} from '../src/schemas/_helpers.ts';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TableColumn = ReturnType<typeof getTableConfig>['columns'][number];

function requireColumn(columns: TableColumn[], name: string): TableColumn {
  const found = columns.find((column) => column.name === name);
  if (!found) {
    throw new Error(`missing column ${name}`);
  }
  return found;
}

function columnNames(columns: TableColumn[]): string[] {
  return columns.map((column) => column.name);
}

describe('TIMESTAMP_CONFIG', () => {
  it('uses millisecond precision with timezone', () => {
    expect(TIMESTAMP_CONFIG).toEqual({
      mode: 'date',
      precision: 3,
      withTimezone: true,
    });
  });
});

describe('generateTextId', () => {
  it('builds a text primary key', () => {
    const table = pgTable('text_pk_table', {
      id: generateTextId(),
    });
    const column = requireColumn(getTableConfig(table).columns, 'id');
    expect(column.columnType).toBe('PgText');
    expect(column.primary).toBe(true);
    expect(column.notNull).toBe(true);
  });
});

describe('generateAuthTimestamps', () => {
  it('exposes created_at and updated_at without deleted_at', () => {
    const table = pgTable('auth_timestamps_table', {
      id: generateTextId(),
      ...generateAuthTimestamps(),
    });
    const names = columnNames(getTableConfig(table).columns);
    expect(names).toEqual(expect.arrayContaining(['created_at', 'updated_at']));
    expect(names).not.toContain('deleted_at');
  });

  it('marks both timestamps required', () => {
    const table = pgTable('auth_timestamps_nullability', {
      id: generateTextId(),
      ...generateAuthTimestamps(),
    });
    const columns = getTableConfig(table).columns;
    expect(requireColumn(columns, 'created_at').notNull).toBe(true);
    expect(requireColumn(columns, 'updated_at').notNull).toBe(true);
  });
});

describe('generateUuid', () => {
  const table = pgTable('uuid_pk_table', {
    id: generateUuid('id'),
  });

  it('declares a not-null primary key uuid column named id', () => {
    const column = requireColumn(getTableConfig(table).columns, 'id');
    expect(column.notNull).toBe(true);
    expect(column.primary).toBe(true);
    expect(column.columnType).toBe('PgUUID');
  });

  it('defaults inserts to distinct uuid v7 values', () => {
    const column = requireColumn(getTableConfig(table).columns, 'id');
    const first = column.defaultFn?.();
    const second = column.defaultFn?.();
    expect(first).toMatch(UUID_V7_PATTERN);
    expect(second).toMatch(UUID_V7_PATTERN);
    expect(first).not.toBe(second);
  });

  it('supports a custom column name', () => {
    const custom = pgTable('custom_pk', {
      projectId: generateUuid('project_id'),
    });
    expect(columnNames(getTableConfig(custom).columns)).toContain('project_id');
  });
});

describe('generateUuidColumn', () => {
  it('builds a not-null non-primary uuid column', () => {
    const table = pgTable('fk_table', {
      workspaceId: generateUuidColumn('workspace_id'),
    });
    const column = requireColumn(getTableConfig(table).columns, 'workspace_id');
    expect(column.notNull).toBe(true);
    expect(column.primary).toBe(false);
  });

  it('defaults to uuid v7 values', () => {
    const table = pgTable('fk_table_default', {
      workspaceId: generateUuidColumn('workspace_id'),
    });
    expect(requireColumn(getTableConfig(table).columns, 'workspace_id').defaultFn?.()).toMatch(
      UUID_V7_PATTERN,
    );
  });
});

describe('generateTimestamps', () => {
  it('exposes created_at, updated_at, and deleted_at', () => {
    const table = pgTable('timestamps_table', {
      id: generateUuid('id'),
      ...generateTimestamps(),
    });
    expect(columnNames(getTableConfig(table).columns)).toEqual(
      expect.arrayContaining(['created_at', 'updated_at', 'deleted_at']),
    );
  });

  it('marks created_at and updated_at required, deleted_at optional', () => {
    const table = pgTable('timestamps_nullability', {
      id: generateUuid('id'),
      ...generateTimestamps(),
    });
    const columns = getTableConfig(table).columns;
    expect(requireColumn(columns, 'created_at').notNull).toBe(true);
    expect(requireColumn(columns, 'updated_at').notNull).toBe(true);
    expect(requireColumn(columns, 'deleted_at').notNull).toBe(false);
  });

  it('builds timestamp columns from TIMESTAMP_CONFIG', () => {
    const table = pgTable('timestamps_precision', {
      id: generateUuid('id'),
      ...generateTimestamps(),
    });
    const createdAt = requireColumn(getTableConfig(table).columns, 'created_at');
    expect(createdAt.columnType).toBe('PgTimestamp');
  });
});

describe('generateTimestampsWithAudit', () => {
  it('creates audit uuid columns without foreign keys by default', () => {
    const table = pgTable('audit_no_fk', {
      id: generateUuid('id'),
      ...generateTimestampsWithAudit(),
    });
    const config = getTableConfig(table);
    expect(columnNames(config.columns)).toEqual(
      expect.arrayContaining([
        'created_by',
        'updated_by',
        'deleted_by',
        'created_at',
        'updated_at',
        'deleted_at',
      ]),
    );
    expect(config.foreignKeys).toHaveLength(0);
  });

  it('attaches user foreign keys when userId is provided', () => {
    const users = pgTable('users', {
      id: generateUuid('id'),
    });
    const table = pgTable('audit_with_fk', {
      id: generateUuid('id'),
      ...generateTimestampsWithAudit({ userId: () => users.id }),
    });
    expect(getTableConfig(table).foreignKeys.length).toBeGreaterThan(0);
  });

  it('marks created_by required and updated_by optional', () => {
    const table = pgTable('audit_nullability', {
      id: generateUuid('id'),
      ...generateTimestampsWithAudit(),
    });
    const columns = getTableConfig(table).columns;
    expect(requireColumn(columns, 'created_by').notNull).toBe(true);
    expect(requireColumn(columns, 'updated_by').notNull).toBe(false);
    expect(requireColumn(columns, 'deleted_by').notNull).toBe(false);
  });

  it('keeps uuid column type for actor columns without userId', () => {
    const table = pgTable('audit_actor_types', {
      id: generateUuid('id'),
      ...generateTimestampsWithAudit(),
    });
    expect(requireColumn(getTableConfig(table).columns, 'created_by').columnType).toBe('PgUUID');
  });
});

describe('uuid foreign key usage', () => {
  it('can reference generateUuid columns in related tables', () => {
    const owners = pgTable('owners', {
      id: generateUuid('id'),
    });
    const items = pgTable('items', {
      id: generateUuid('id'),
      ownerId: uuid('owner_id')
        .notNull()
        .references(() => owners.id, { onDelete: 'cascade' }),
    });
    expect(getTableConfig(items).foreignKeys).toHaveLength(1);
  });
});
