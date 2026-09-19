import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateAuthTimestamps, generateTextId } from './_helpers.ts';

// Better Auth tables. Product "workspace" maps to organizations.id.

export const users = pgTable(
  'users',
  {
    id: generateTextId(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    ...generateAuthTimestamps(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: generateTextId(),
    expiresAt: timestamp('expires_at', TIMESTAMP_CONFIG).notNull(),
    token: text('token').notNull(),
    ...generateAuthTimestamps(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id'),
  },
  (table) => [
    uniqueIndex('sessions_token_unique').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: generateTextId(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', TIMESTAMP_CONFIG),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', TIMESTAMP_CONFIG),
    scope: text('scope'),
    password: text('password'),
    ...generateAuthTimestamps(),
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: generateTextId(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', TIMESTAMP_CONFIG).notNull(),
    ...generateAuthTimestamps(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: generateTextId(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logo: text('logo'),
    createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
    metadata: text('metadata'),
  },
  (table) => [uniqueIndex('organizations_slug_unique').on(table.slug)],
);

export const members = pgTable(
  'members',
  {
    id: generateTextId(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
  },
  (table) => [
    index('members_organization_id_idx').on(table.organizationId),
    index('members_user_id_idx').on(table.userId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: generateTextId(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', TIMESTAMP_CONFIG).notNull(),
    createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('invitations_organization_id_idx').on(table.organizationId),
    index('invitations_email_idx').on(table.email),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
