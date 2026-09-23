import type { AuthorizedContext } from '@stampp/access';
import type { ScimToken } from '@stampp/database';
import type { ScimTokenCreateInput, ScimTokenCreated, ScimTokenDto } from '@stampp/shared';
import { scimTokens } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { getDb } from '~/server/utils/db.ts';

export type GeneratedScimToken = {
  token: string;
  prefix: string;
  tokenHash: string;
};

export function generateScimToken(): GeneratedScimToken {
  const token = `scim_${randomBytes(24).toString('base64url')}`;
  return {
    token,
    prefix: token.slice(0, 12),
    tokenHash: hashScimToken(token),
  };
}

export function hashScimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function toScimTokenDto(row: ScimToken): ScimTokenDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listScimTokens(ctx: AuthorizedContext): Promise<{ items: ScimTokenDto[] }> {
  const rows = await ctx.db.client
    .select()
    .from(scimTokens)
    .where(and(eq(scimTokens.workspaceId, ctx.workspaceId), isNull(scimTokens.revokedAt)))
    .orderBy(scimTokens.createdAt);
  return { items: rows.map(toScimTokenDto) };
}

export async function createScimToken(
  ctx: AuthorizedContext,
  input: ScimTokenCreateInput,
  requestId: string,
): Promise<ScimTokenCreated> {
  const generated = generateScimToken();
  const inserted = await ctx.db.client
    .insert(scimTokens)
    .values({
      workspaceId: ctx.workspaceId,
      name: input.name,
      prefix: generated.prefix,
      tokenHash: generated.tokenHash,
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create SCIM token', requestId);
  }
  await recordAudit(ctx, requestId, {
    action: 'scim.token_created',
    entityType: 'scim_token',
    entityId: row.id,
    after: { ...row, tokenHash: undefined },
  });
  return { token: generated.token, tokenDto: toScimTokenDto(row) };
}

export async function revokeScimToken(
  ctx: AuthorizedContext,
  tokenId: string,
  requestId: string,
): Promise<void> {
  const updated = await ctx.db.client
    .update(scimTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(scimTokens.workspaceId, ctx.workspaceId),
        eq(scimTokens.id, tokenId),
        isNull(scimTokens.revokedAt),
      ),
    )
    .returning();
  const row = updated[0];
  if (!row) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'SCIM token not found', requestId);
  }
  await recordAudit(ctx, requestId, {
    action: 'scim.token_revoked',
    entityType: 'scim_token',
    entityId: tokenId,
    after: { ...row, tokenHash: undefined },
  });
}

export async function resolveScimWorkspace(authorization: string | null): Promise<string | null> {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token.startsWith('scim_')) {
    return null;
  }
  const db = getDb();
  const hash = hashScimToken(token);
  const rows = await db
    .select()
    .from(scimTokens)
    .where(and(eq(scimTokens.tokenHash, hash), isNull(scimTokens.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  await db.update(scimTokens).set({ lastUsedAt: new Date() }).where(eq(scimTokens.id, row.id));
  return row.workspaceId;
}
