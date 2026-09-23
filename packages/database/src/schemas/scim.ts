import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

/** Bearer tokens used by IdPs to call the SCIM 2.0 service provider. */
export const scimTokens = pgTable(
  'scim_tokens',
  {
    id: generateEntityId('scimt'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    prefix: varchar('prefix', { length: 16 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    lastUsedAt: timestamp('last_used_at', TIMESTAMP_CONFIG),
    revokedAt: timestamp('revoked_at', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('scim_tokens_workspace_id_idx').on(table.workspaceId),
    index('scim_tokens_token_hash_idx').on(table.tokenHash),
  ],
);

export type ScimToken = typeof scimTokens.$inferSelect;
export type NewScimToken = typeof scimTokens.$inferInsert;
