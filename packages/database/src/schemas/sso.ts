import { index, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

export type SsoProviderStatus = 'enabled' | 'disabled';

/**
 * Workspace OIDC provider. Client secrets stay server-side and are never returned after create.
 */
export const ssoProviders = pgTable(
  'sso_providers',
  {
    id: generateEntityId('ssop'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 40 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    issuer: text('issuer').notNull(),
    clientId: varchar('client_id', { length: 200 }).notNull(),
    clientSecret: text('client_secret').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default(['openid', 'email', 'profile']),
    allowedEmailDomains: jsonb('allowed_email_domains').$type<string[]>().notNull().default([]),
    status: text('status').$type<SsoProviderStatus>().notNull().default('enabled'),
    ...generateTimestamps(),
  },
  (table) => [
    index('sso_providers_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('sso_providers_workspace_provider_unique').on(table.workspaceId, table.providerId),
  ],
);

export type SsoProvider = typeof ssoProviders.$inferSelect;
export type NewSsoProvider = typeof ssoProviders.$inferInsert;
