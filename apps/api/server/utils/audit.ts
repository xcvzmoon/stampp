import type { AuthorizedContext } from '@stampp/access';
import type { AuditMetadata, NewAuditEvent } from '@stampp/database';
import { auditEvents } from '@stampp/database';

export type AuditWrite = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export function createAuditEvent(
  ctx: Pick<AuthorizedContext, 'userId' | 'workspaceId'>,
  requestId: string,
  entry: AuditWrite,
): NewAuditEvent {
  const metadata: AuditMetadata = { requestId };
  return {
    workspaceId: ctx.workspaceId,
    actorUserId: ctx.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    metadata,
  };
}

export async function recordAudit(
  ctx: AuthorizedContext,
  requestId: string,
  entry: AuditWrite,
): Promise<void> {
  await ctx.db.client.insert(auditEvents).values(createAuditEvent(ctx, requestId, entry));
}
