import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import {
  accounts,
  invitations,
  members,
  organizations,
  sessions,
  users,
  verifications,
} from '../src/schemas/auth.ts';

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

function hasUniqueIndex(table: AnyPgTable, indexName: string): boolean {
  return getTableConfig(table).indexes.some(
    (entry) => entry.config.name === indexName && entry.config.unique,
  );
}

describe('auth schema tables', () => {
  it('uses plural snake_case table names for Better Auth', () => {
    expect(getTableConfig(users).name).toBe('users');
    expect(getTableConfig(sessions).name).toBe('sessions');
    expect(getTableConfig(accounts).name).toBe('accounts');
    expect(getTableConfig(verifications).name).toBe('verifications');
    expect(getTableConfig(organizations).name).toBe('organizations');
    expect(getTableConfig(members).name).toBe('members');
    expect(getTableConfig(invitations).name).toBe('invitations');
  });

  it('gives every auth table a text primary key', () => {
    for (const table of [
      users,
      sessions,
      accounts,
      verifications,
      organizations,
      members,
      invitations,
    ]) {
      const id = requireColumn(getTableConfig(table).columns, 'id');
      expect(id.columnType).toBe('PgText');
      expect(id.primary).toBe(true);
    }
  });

  it('enforces unique email, session token, and organization slug', () => {
    expect(hasUniqueIndex(users, 'users_email_unique')).toBe(true);
    expect(hasUniqueIndex(sessions, 'sessions_token_unique')).toBe(true);
    expect(hasUniqueIndex(organizations, 'organizations_slug_unique')).toBe(true);
  });

  it('cascades membership and session deletes from users', () => {
    const sessionsFks = getTableConfig(sessions).foreignKeys;
    expect(sessionsFks).toHaveLength(1);
    expect(sessionsFks[0]?.onDelete).toBe('cascade');

    const membersFks = getTableConfig(members).foreignKeys;
    expect(membersFks.map((fk) => fk.onDelete)).toEqual(['cascade', 'cascade']);
  });

  it('stores active organization on the session row', () => {
    expect(columnNames(getTableConfig(sessions).columns)).toContain('active_organization_id');
  });

  it('keeps organization metadata as text for Better Auth', () => {
    const metadata = requireColumn(getTableConfig(organizations).columns, 'metadata');
    expect(metadata.columnType).toBe('PgText');
    expect(metadata.notNull).toBe(false);
  });
});
