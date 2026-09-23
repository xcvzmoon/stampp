import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';

export type KioskDeviceStatus = 'active' | 'revoked';

/**
 * Shared wall-mounted device authorized by a high-entropy key (shown once).
 * Kiosk punches only create attendance records, never project time.
 */
export const kioskDevices = pgTable(
  'kiosk_devices',
  {
    id: generateEntityId('kdev'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    /** Displayable non-secret prefix of the device key (for identification). */
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    deviceKeyHash: text('device_key_hash').notNull(),
    status: text('status').$type<KioskDeviceStatus>().notNull().default('active'),
    lastUsedAt: timestamp('last_used_at', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('kiosk_devices_workspace_id_idx').on(table.workspaceId),
    index('kiosk_devices_workspace_id_status_idx').on(table.workspaceId, table.status),
    uniqueIndex('kiosk_devices_workspace_name_unique').on(table.workspaceId, table.name),
    uniqueIndex('kiosk_devices_key_hash_unique').on(table.deviceKeyHash),
  ],
);

/**
 * Per-member kiosk credentials. PIN and QR secrets are stored only as hashes.
 */
export const kioskMemberCredentials = pgTable(
  'kiosk_member_credentials',
  {
    id: generateEntityId('kcred'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pinHash: text('pin_hash'),
    pinSalt: text('pin_salt'),
    qrTokenHash: text('qr_token_hash'),
    ...generateTimestamps(),
  },
  (table) => [
    index('kiosk_member_credentials_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('kiosk_member_credentials_workspace_user_unique').on(
      table.workspaceId,
      table.userId,
    ),
    check(
      'kiosk_member_credentials_has_method_check',
      sql`((${table.pinHash} is not null and ${table.pinSalt} is not null) or ${table.qrTokenHash} is not null)`,
    ),
  ],
);

export type KioskDevice = typeof kioskDevices.$inferSelect;
export type NewKioskDevice = typeof kioskDevices.$inferInsert;
export type KioskMemberCredential = typeof kioskMemberCredentials.$inferSelect;
export type NewKioskMemberCredential = typeof kioskMemberCredentials.$inferInsert;
