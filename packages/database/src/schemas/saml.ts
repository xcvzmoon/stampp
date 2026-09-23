import { index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

export type SamlProviderStatus = 'enabled' | 'disabled';

/**
 * Workspace SAML identity provider (service-provider mode).
 * Certificate is the IdP signing cert; no private SP key is stored in v1 (unsigned AuthnRequest).
 */
export const samlProviders = pgTable(
  'saml_providers',
  {
    id: generateEntityId('samlp'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    entityId: text('entity_id').notNull(),
    entryPoint: text('entry_point').notNull(),
    certificate: text('certificate').notNull(),
    emailAttribute: varchar('email_attribute', { length: 80 }).notNull().default('email'),
    allowedEmailDomains: jsonb('allowed_email_domains').$type<string[]>().notNull().default([]),
    status: text('status').$type<SamlProviderStatus>().notNull().default('enabled'),
    ...generateTimestamps(),
  },
  (table) => [index('saml_providers_workspace_id_idx').on(table.workspaceId)],
);

export type SamlProvider = typeof samlProviders.$inferSelect;
export type NewSamlProvider = typeof samlProviders.$inferInsert;
