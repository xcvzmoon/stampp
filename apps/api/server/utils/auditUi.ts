import type { AuthorizedContext } from '@stampp/access';
import type { AuditEventDto, AuditRetentionDto, AuditListQuery } from '@stampp/shared';
import { auditEvents, auditRetentionPolicies, users } from '@stampp/database';
import { auditCsvCell, auditPurgeCutoff, DEFAULT_AUDIT_RETENTION_DAYS } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';

export function toAuditEventDto(row: typeof auditEvents.$inferSelect): AuditEventDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
  };
}

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Audit retention policy not found', requestId);
}

export async function listAuditEvents(
  ctx: AuthorizedContext,
  query: AuditListQuery,
): Promise<{ items: AuditEventDto[]; nextCursor: string | null }> {
  const conditions = [eq(auditEvents.workspaceId, ctx.workspaceId)];
  if (query.cursor) {
    conditions.push(lt(auditEvents.id, query.cursor));
  }
  if (query.action) {
    conditions.push(eq(auditEvents.action, query.action));
  }
  if (query.entityType) {
    conditions.push(eq(auditEvents.entityType, query.entityType));
  }
  if (query.entityId) {
    conditions.push(eq(auditEvents.entityId, query.entityId));
  }
  if (query.actorUserId) {
    conditions.push(eq(auditEvents.actorUserId, query.actorUserId));
  }
  if (query.from) {
    conditions.push(gte(auditEvents.createdAt, new Date(query.from)));
  }
  if (query.to) {
    conditions.push(lt(auditEvents.createdAt, new Date(query.to)));
  }

  const limit = query.limit ?? 50;
  const rows = await ctx.db.client
    .select()
    .from(auditEvents)
    .where(and(...conditions))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toAuditEventDto),
    nextCursor: rows.length > limit && last ? last.id : null,
  };
}

export async function exportAuditEventsCsv(ctx: AuthorizedContext): Promise<string> {
  const rows = await ctx.db.client
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.workspaceId, ctx.workspaceId))
    .orderBy(auditEvents.createdAt);
  const header = ['id', 'action', 'entityType', 'entityId', 'actorUserId', 'createdAt'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        auditCsvCell(row.id),
        auditCsvCell(row.action),
        auditCsvCell(row.entityType),
        auditCsvCell(row.entityId),
        auditCsvCell(row.actorUserId ?? ''),
        auditCsvCell(row.createdAt.toISOString()),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function getAuditRetention(ctx: AuthorizedContext): Promise<AuditRetentionDto> {
  const rows = await ctx.db.client
    .select()
    .from(auditRetentionPolicies)
    .where(eq(auditRetentionPolicies.workspaceId, ctx.workspaceId))
    .limit(1);
  const row = rows[0];
  return {
    workspaceId: ctx.workspaceId,
    retentionDays: row?.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS,
    updatedAt: row?.updatedAt.toISOString() ?? new Date(0).toISOString(),
  };
}

export async function setAuditRetention(
  ctx: AuthorizedContext,
  retentionDays: number,
  requestId: string,
): Promise<AuditRetentionDto> {
  const existing = await ctx.db.client
    .select()
    .from(auditRetentionPolicies)
    .where(eq(auditRetentionPolicies.workspaceId, ctx.workspaceId))
    .limit(1);
  const row = existing[0];
  if (row) {
    const updated = await ctx.db.client
      .update(auditRetentionPolicies)
      .set({ retentionDays, updatedAt: new Date() })
      .where(eq(auditRetentionPolicies.workspaceId, ctx.workspaceId))
      .returning();
    const next = updated[0];
    if (!next) throw notFound(requestId);
    await recordAudit(ctx, requestId, {
      action: 'audit.retention_updated',
      entityType: 'audit_retention',
      entityId: next.id,
      before: { retentionDays: row.retentionDays },
      after: { retentionDays: next.retentionDays },
    });
    return {
      workspaceId: ctx.workspaceId,
      retentionDays: next.retentionDays,
      updatedAt: next.updatedAt.toISOString(),
    };
  }

  const inserted = await ctx.db.client
    .insert(auditRetentionPolicies)
    .values({ workspaceId: ctx.workspaceId, retentionDays })
    .returning();
  const created = inserted[0];
  if (!created) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: 'audit.retention_updated',
    entityType: 'audit_retention',
    entityId: created.id,
    after: { retentionDays: created.retentionDays },
  });
  return {
    workspaceId: ctx.workspaceId,
    retentionDays: created.retentionDays,
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function purgeExpiredAuditEvents(
  ctx: AuthorizedContext,
  retentionDays: number,
): Promise<{ deleted: number }> {
  const cutoff = auditPurgeCutoff(retentionDays);
  const deleted = await ctx.db.client
    .delete(auditEvents)
    .where(and(eq(auditEvents.workspaceId, ctx.workspaceId), lt(auditEvents.createdAt, cutoff)))
    .returning({ id: auditEvents.id });
  return { deleted: deleted.length };
}

export async function loadWorkspaceActor(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { getDb } = await import('~/server/utils/db.ts');
  const rows = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.email ?? userId;
}
