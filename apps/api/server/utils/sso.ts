import type { AuthorizedContext } from '@stampp/access';
import type { SsoProvider } from '@stampp/database';
import type {
  CreateSsoProviderInput,
  SsoProviderDto,
  UpdateSsoProviderInput,
} from '@stampp/shared';
import { ssoProviders } from '@stampp/database';
import { normalizeAllowedEmailDomains } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { resetAuth } from '~/server/utils/auth.ts';
import { loadEnabledSsoProviderConfigs } from '~/server/utils/ssoStore.ts';

export function toSsoProviderDto(row: SsoProvider): SsoProviderDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    providerId: row.providerId,
    name: row.name,
    issuer: row.issuer,
    clientId: row.clientId,
    scopes: row.scopes,
    allowedEmailDomains: row.allowedEmailDomains,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'SSO provider not found', requestId);
}

export async function listSsoProviders(
  ctx: AuthorizedContext,
): Promise<{ items: SsoProviderDto[] }> {
  const rows = await ctx.db.client
    .select()
    .from(ssoProviders)
    .where(and(eq(ssoProviders.workspaceId, ctx.workspaceId), isNull(ssoProviders.deletedAt)))
    .orderBy(ssoProviders.name);
  return { items: rows.map(toSsoProviderDto) };
}

export async function createSsoProvider(
  ctx: AuthorizedContext,
  input: CreateSsoProviderInput,
  requestId: string,
): Promise<SsoProviderDto> {
  const existing = await ctx.db.client
    .select({ id: ssoProviders.id })
    .from(ssoProviders)
    .where(
      and(
        eq(ssoProviders.workspaceId, ctx.workspaceId),
        eq(ssoProviders.providerId, input.providerId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    throw toApiError(ERROR_CODES.SSO_PROVIDER_ID_TAKEN, 'Provider id already exists', requestId);
  }

  const inserted = await ctx.db.client
    .insert(ssoProviders)
    .values({
      workspaceId: ctx.workspaceId,
      providerId: input.providerId,
      name: input.name,
      issuer: input.issuer.replace(/\/$/, ''),
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      scopes:
        input.scopes && input.scopes.length > 0 ? input.scopes : ['openid', 'email', 'profile'],
      allowedEmailDomains: input.allowedEmailDomains ?? [],
      status: 'enabled',
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create SSO provider', requestId);
  }

  await recordAudit(ctx, requestId, {
    action: 'sso.provider_created',
    entityType: 'sso_provider',
    entityId: row.id,
    after: { ...row, clientSecret: undefined },
  });
  await loadEnabledSsoProviderConfigs().catch(() => undefined);
  resetAuth();
  return toSsoProviderDto(row);
}

async function getProviderRow(
  ctx: AuthorizedContext,
  providerRowId: string,
  requestId: string,
): Promise<SsoProvider> {
  const rows = await ctx.db.client
    .select()
    .from(ssoProviders)
    .where(
      and(
        eq(ssoProviders.workspaceId, ctx.workspaceId),
        eq(ssoProviders.id, providerRowId),
        isNull(ssoProviders.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

export async function updateSsoProvider(
  ctx: AuthorizedContext,
  providerRowId: string,
  input: UpdateSsoProviderInput,
  requestId: string,
): Promise<SsoProviderDto> {
  const before = await getProviderRow(ctx, providerRowId, requestId);
  const updated = await ctx.db.client
    .update(ssoProviders)
    .set({
      name: input.name ?? before.name,
      issuer: input.issuer ? input.issuer.replace(/\/$/, '') : before.issuer,
      clientId: input.clientId ?? before.clientId,
      clientSecret: input.clientSecret ?? before.clientSecret,
      scopes: input.scopes && input.scopes.length > 0 ? input.scopes : before.scopes,
      allowedEmailDomains:
        input.allowedEmailDomains === undefined
          ? before.allowedEmailDomains
          : normalizeAllowedEmailDomains(input.allowedEmailDomains),
      status: input.status ?? before.status,
    })
    .where(and(eq(ssoProviders.workspaceId, ctx.workspaceId), eq(ssoProviders.id, providerRowId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);

  await recordAudit(ctx, requestId, {
    action: 'sso.provider_updated',
    entityType: 'sso_provider',
    entityId: providerRowId,
    before: { ...before, clientSecret: undefined },
    after: { ...row, clientSecret: undefined },
  });
  await loadEnabledSsoProviderConfigs().catch(() => undefined);
  resetAuth();
  return toSsoProviderDto(row);
}

export async function deleteSsoProvider(
  ctx: AuthorizedContext,
  providerRowId: string,
  requestId: string,
): Promise<void> {
  const before = await getProviderRow(ctx, providerRowId, requestId);
  await ctx.db.client
    .delete(ssoProviders)
    .where(and(eq(ssoProviders.workspaceId, ctx.workspaceId), eq(ssoProviders.id, providerRowId)));

  await recordAudit(ctx, requestId, {
    action: 'sso.provider_deleted',
    entityType: 'sso_provider',
    entityId: providerRowId,
    before: { ...before, clientSecret: undefined },
  });
  await loadEnabledSsoProviderConfigs().catch(() => undefined);
  resetAuth();
}
