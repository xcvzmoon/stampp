import type { AuthorizedContext } from '@stampp/access';
import type { SamlProvider } from '@stampp/database';
import type {
  CreateSamlProviderInput,
  SamlProviderDto,
  UpdateSamlProviderInput,
} from '@stampp/shared';
import { samlProviders } from '@stampp/database';
import { normalizePemCertificate, samlMetadataPath } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { ENV } from '~/server/utils/env.ts';

export function toSamlProviderDto(row: SamlProvider): SamlProviderDto {
  const appUrl = (ENV.PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    entityId: row.entityId,
    entryPoint: row.entryPoint,
    emailAttribute: row.emailAttribute,
    allowedEmailDomains: row.allowedEmailDomains,
    status: row.status,
    metadataUrl: `${ENV.PUBLIC_APP_URL ? '' : ''}${appUrl}${samlMetadataPath(row.id)}`.replace(
      /([^:]\/)\/+/g,
      '$1',
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'SAML provider not found', requestId);
}

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export async function listSamlProviders(
  ctx: AuthorizedContext,
): Promise<{ items: SamlProviderDto[] }> {
  const rows = await ctx.db.client
    .select()
    .from(samlProviders)
    .where(and(eq(samlProviders.workspaceId, ctx.workspaceId), isNull(samlProviders.deletedAt)))
    .orderBy(samlProviders.name);
  return { items: rows.map(toSamlProviderDto) };
}

export async function createSamlProvider(
  ctx: AuthorizedContext,
  input: CreateSamlProviderInput,
  requestId: string,
): Promise<SamlProviderDto> {
  const inserted = await ctx.db.client
    .insert(samlProviders)
    .values({
      workspaceId: ctx.workspaceId,
      name: input.name,
      entityId: input.entityId.trim(),
      entryPoint: input.entryPoint.replace(/\/$/, ''),
      certificate: normalizePemCertificate(input.certificate),
      emailAttribute: input.emailAttribute?.trim() || 'email',
      allowedEmailDomains: parseAllowedDomains(input.allowedEmailDomains),
      status: 'enabled',
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create SAML provider', requestId);
  }
  await recordAudit(ctx, requestId, {
    action: 'saml.provider_created',
    entityType: 'saml_provider',
    entityId: row.id,
    after: { ...row, certificate: undefined },
  });
  return toSamlProviderDto(row);
}

async function getProviderRow(
  ctx: AuthorizedContext,
  providerRowId: string,
  requestId: string,
): Promise<SamlProvider> {
  const rows = await ctx.db.client
    .select()
    .from(samlProviders)
    .where(
      and(
        eq(samlProviders.workspaceId, ctx.workspaceId),
        eq(samlProviders.id, providerRowId),
        isNull(samlProviders.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

export async function updateSamlProvider(
  ctx: AuthorizedContext,
  providerRowId: string,
  input: UpdateSamlProviderInput,
  requestId: string,
): Promise<SamlProviderDto> {
  const before = await getProviderRow(ctx, providerRowId, requestId);
  const updated = await ctx.db.client
    .update(samlProviders)
    .set({
      name: input.name ?? before.name,
      entityId: input.entityId?.trim() ?? before.entityId,
      entryPoint: input.entryPoint ? input.entryPoint.replace(/\/$/, '') : before.entryPoint,
      certificate: input.certificate
        ? normalizePemCertificate(input.certificate)
        : before.certificate,
      emailAttribute: input.emailAttribute?.trim() || before.emailAttribute,
      allowedEmailDomains:
        input.allowedEmailDomains === undefined
          ? before.allowedEmailDomains
          : parseAllowedDomains(input.allowedEmailDomains),
      status: input.status ?? before.status,
    })
    .where(and(eq(samlProviders.workspaceId, ctx.workspaceId), eq(samlProviders.id, providerRowId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: 'saml.provider_updated',
    entityType: 'saml_provider',
    entityId: providerRowId,
    before: { ...before, certificate: undefined },
    after: { ...row, certificate: undefined },
  });
  return toSamlProviderDto(row);
}

export async function deleteSamlProvider(
  ctx: AuthorizedContext,
  providerRowId: string,
  requestId: string,
): Promise<void> {
  const before = await getProviderRow(ctx, providerRowId, requestId);
  await ctx.db.client
    .delete(samlProviders)
    .where(
      and(eq(samlProviders.workspaceId, ctx.workspaceId), eq(samlProviders.id, providerRowId)),
    );
  await recordAudit(ctx, requestId, {
    action: 'saml.provider_deleted',
    entityType: 'saml_provider',
    entityId: providerRowId,
    before: { ...before, certificate: undefined },
  });
}

export async function loadSamlProviderById(providerRowId: string): Promise<SamlProvider | null> {
  const { getDb } = await import('~/server/utils/db.ts');
  const rows = await getDb()
    .select()
    .from(samlProviders)
    .where(and(eq(samlProviders.id, providerRowId), isNull(samlProviders.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}
