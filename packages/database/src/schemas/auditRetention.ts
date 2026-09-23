import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId } from './_helpers.ts';
import { organizations } from './auth.ts';

/** Workspace audit retention policy. Purge removes rows older than this window. */
export const auditRetentionPolicies = pgTable('audit_retention_policies', {
  id: generateEntityId('areten'),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  retentionDays: integer('retention_days').notNull().default(365),
  updatedAt: timestamp('updated_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
});

export type AuditRetentionPolicy = typeof auditRetentionPolicies.$inferSelect;
export type NewAuditRetentionPolicy = typeof auditRetentionPolicies.$inferInsert;
