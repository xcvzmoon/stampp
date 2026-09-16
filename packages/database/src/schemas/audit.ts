import type { InferSelectModel } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateUuid } from './_helpers.ts';

/**
 * Extra context on an audit row. Prefer named keys over free-form blobs.
 *
 * @example
 * ```ts
 * const meta: AuditMetadata = {
 *   ip: '203.0.113.10',
 *   requestId: '01900000-0000-7000-8000-0000000000aa',
 * };
 * ```
 */
export type AuditMetadata = {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

/**
 * Append-only audit trail. Write through AuditTrail inside deep modules.
 * Never update or delete these rows from application code.
 *
 * @example
 * ```ts
 * await db.insert(auditEvents).values({
 *   workspaceId,
 *   actorUserId,
 *   action: 'time_entry.updated',
 *   entityType: 'time_entry',
 *   entityId: entryId,
 *   before: { durationMinutes: 30 },
 *   after: { durationMinutes: 45 },
 *   metadata: { requestId },
 * });
 * ```
 */
export const auditEvents = pgTable('audit_events', {
  id: generateUuid('id'),
  workspaceId: text('workspace_id').notNull(),
  actorUserId: text('actor_user_id'),
  action: varchar('action', { length: 128 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: text('entity_id').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  metadata: jsonb('metadata').$type<AuditMetadata>().notNull().default({}),
  createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
});

export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
