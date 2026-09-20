import type { AuthorizedContext } from '@stampp/access';
import type { PersonalAccessToken } from '@stampp/database';
import type { CreatePersonalAccessTokenInput, PersonalAccessTokenDto } from '@stampp/shared';
import { personalAccessTokens } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import {
  generatePersonalAccessToken,
  hashPersonalAccessToken,
} from '~/server/utils/personalAccessTokens.ts';

export function toPersonalAccessTokenDto(row: PersonalAccessToken): PersonalAccessTokenDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    name: row.name,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPersonalAccessTokens(
  ctx: AuthorizedContext,
): Promise<PersonalAccessTokenDto[]> {
  const rows = await ctx.db.client
    .select()
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.workspaceId, ctx.workspaceId),
        eq(personalAccessTokens.userId, ctx.userId),
      ),
    )
    .orderBy(asc(personalAccessTokens.createdAt));
  return rows.map(toPersonalAccessTokenDto);
}

export async function createPersonalAccessToken(
  ctx: AuthorizedContext,
  input: CreatePersonalAccessTokenInput,
  requestId: string,
): Promise<{ token: string; tokenDto: PersonalAccessTokenDto }> {
  const generated = generatePersonalAccessToken();
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw toApiError(ERROR_CODES.BAD_REQUEST, 'expiresAt must be a valid timestamp', requestId);
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw toApiError(ERROR_CODES.BAD_REQUEST, 'expiresAt must be in the future', requestId);
    }
  }

  const inserted = await ctx.db.client
    .insert(personalAccessTokens)
    .values({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      name: input.name,
      tokenHash: generated.hash,
      expiresAt,
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create personal access token', requestId);
  }
  await recordAudit(ctx, requestId, {
    action: 'personal_access_token.created',
    entityType: 'personal_access_token',
    entityId: row.id,
    after: { id: row.id, name: row.name },
  });
  return { token: generated.token, tokenDto: toPersonalAccessTokenDto(row) };
}

export async function revokePersonalAccessToken(
  ctx: AuthorizedContext,
  tokenId: string,
  requestId: string,
): Promise<void> {
  const rows = await ctx.db.client
    .select()
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.workspaceId, ctx.workspaceId),
        eq(personalAccessTokens.userId, ctx.userId),
        eq(personalAccessTokens.id, tokenId),
      ),
    )
    .limit(1);
  const before = rows[0];
  if (!before) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'Personal access token not found', requestId);
  }
  if (before.revokedAt) {
    return;
  }
  await ctx.db.client
    .update(personalAccessTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(personalAccessTokens.id, tokenId));
  await recordAudit(ctx, requestId, {
    action: 'personal_access_token.revoked',
    entityType: 'personal_access_token',
    entityId: tokenId,
    before,
  });
}

export { hashPersonalAccessToken };
