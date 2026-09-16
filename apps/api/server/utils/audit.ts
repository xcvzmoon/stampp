import type { AuthorizedContext } from '@stampp/access';
import { auditEvents } from '@stampp/database';

export type AuditWrite = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export async function recordAudit(ctx: AuthorizedContext, entry: AuditWrite): Promise<void> {
  await ctx.db.client.insert(auditEvents).values({
    workspaceId: ctx.workspaceId,
    actorUserId: ctx.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    metadata: {},
  });
}
