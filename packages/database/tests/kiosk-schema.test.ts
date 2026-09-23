import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { kioskDevices, kioskMemberCredentials } from '../src/schemas/kiosk.ts';

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

describe('kiosk schema', () => {
  it('uses plural snake_case table names', () => {
    expect(getTableConfig(kioskDevices).name).toBe('kiosk_devices');
    expect(getTableConfig(kioskMemberCredentials).name).toBe('kiosk_member_credentials');
  });

  it('stores device key hash and status', () => {
    const columns = getTableConfig(kioskDevices).columns;
    expect(requireColumn(columns, 'device_key_hash').notNull).toBe(true);
    expect(requireColumn(columns, 'key_prefix').notNull).toBe(true);
    expect(requireColumn(columns, 'status').notNull).toBe(true);
    expect(requireColumn(columns, 'last_used_at').notNull).toBe(false);
    expect(hasIndex(kioskDevices, 'kiosk_devices_workspace_name_unique', true)).toBe(true);
    expect(hasIndex(kioskDevices, 'kiosk_devices_key_hash_unique', true)).toBe(true);
  });

  it('stores hashed member credentials uniquely per workspace user', () => {
    const columns = getTableConfig(kioskMemberCredentials).columns;
    expect(requireColumn(columns, 'pin_hash').notNull).toBe(false);
    expect(requireColumn(columns, 'qr_token_hash').notNull).toBe(false);
    expect(
      hasIndex(kioskMemberCredentials, 'kiosk_member_credentials_workspace_user_unique', true),
    ).toBe(true);
  });
});
