import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

export type WebhookSubscriptionStatus = 'active' | 'disabled';
export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'dead';

/**
 * Outbound HTTPS endpoint with a signing secret. The secret is shown once at
 * create/rotate and stored so deliveries can be HMAC-signed.
 */
export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: generateEntityId('whk'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    description: varchar('description', { length: 200 }),
    events: jsonb('events').$type<string[]>().notNull(),
    status: text('status').$type<WebhookSubscriptionStatus>().notNull().default('active'),
    /** Displayable non-secret prefix (`whsec_…`). */
    secretPrefix: varchar('secret_prefix', { length: 16 }).notNull(),
    /** Signing secret. Never returned after create/rotate. */
    secret: text('secret').notNull(),
    lastDeliveryAt: timestamp('last_delivery_at', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('webhook_subscriptions_workspace_id_idx').on(table.workspaceId),
    index('webhook_subscriptions_workspace_status_idx').on(table.workspaceId, table.status),
  ],
);

/**
 * One row per delivery attempt chain. Status advances
 * pending → success | failed → dead after retries are exhausted.
 */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: generateEntityId('whd'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').$type<WebhookDeliveryStatus>().notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastStatusCode: integer('last_status_code'),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', TIMESTAMP_CONFIG),
    completedAt: timestamp('completed_at', TIMESTAMP_CONFIG),
    ...generateTimestamps(),
  },
  (table) => [
    index('webhook_deliveries_workspace_id_idx').on(table.workspaceId),
    index('webhook_deliveries_webhook_id_idx').on(table.webhookId),
    index('webhook_deliveries_status_idx').on(table.status),
    check('webhook_deliveries_attempt_count_check', sql`${table.attemptCount} >= 0`),
  ],
);

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
