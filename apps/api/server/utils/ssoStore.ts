import type { GenericOAuthConfig } from 'better-auth/plugins';
import { ssoProviders } from '@stampp/database';
import { emailMatchesAllowedDomains, ssoDiscoveryUrl } from '@stampp/domain';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '~/server/utils/db.ts';

export type LoadedSsoConfig = {
  providerId: string;
  name: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  allowedEmailDomains: string[];
  workspaceId: string;
  rowId: string;
};

let cache: LoadedSsoConfig[] | null = null;

export function peekSsoConfigs(): LoadedSsoConfig[] {
  return cache ?? [];
}

export async function loadEnabledSsoProviderConfigs(): Promise<LoadedSsoConfig[]> {
  const rows = await getDb()
    .select()
    .from(ssoProviders)
    .where(and(eq(ssoProviders.status, 'enabled'), isNull(ssoProviders.deletedAt)));

  cache = rows.map((row) => ({
    rowId: row.id,
    workspaceId: row.workspaceId,
    providerId: `wsp_${row.id}`,
    name: row.name,
    discoveryUrl: ssoDiscoveryUrl(row.issuer),
    clientId: row.clientId,
    clientSecret: row.clientSecret,
    scopes: row.scopes,
    allowedEmailDomains: row.allowedEmailDomains,
  }));
  return cache;
}

export function toGenericOAuthConfigs(entries: LoadedSsoConfig[]): GenericOAuthConfig[] {
  return entries.map((entry) => ({
    providerId: entry.providerId,
    name: entry.name,
    discoveryUrl: entry.discoveryUrl,
    requireIdTokenVerification: true,
    clientId: entry.clientId,
    clientSecret: entry.clientSecret,
    scopes: entry.scopes,
    pkce: true,
    mapProfileToUser(profile) {
      const email = String(profile.email ?? '');
      if (!emailMatchesAllowedDomains(email, entry.allowedEmailDomains)) {
        throw new Error('sso.email_domain_blocked');
      }
      const name = String(profile.name ?? email);
      return {
        email,
        name,
        emailVerified: profile.email_verified === true,
      };
    },
  }));
}
