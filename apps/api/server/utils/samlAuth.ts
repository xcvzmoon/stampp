import type { Profile } from '@node-saml/node-saml';
import type { SamlProvider } from '@stampp/database';
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import { accounts, users } from '@stampp/database';
import { emailMatchesAllowedDomains, samlAcsPath, samlMetadataPath } from '@stampp/domain';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import * as v from 'valibot';
import { getAuth } from '~/server/utils/auth.ts';
import { getDb } from '~/server/utils/db.ts';
import { ENV } from '~/server/utils/env.ts';

function appOrigin(): string {
  return (ENV.PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function samlCallbackUrl(providerRowId: string): string {
  return `${appOrigin()}${samlAcsPath(providerRowId)}`;
}

export function createSamlClient(provider: SamlProvider): SAML {
  return new SAML({
    idpCert: provider.certificate,
    entryPoint: provider.entryPoint,
    issuer: `${appOrigin()}${samlMetadataPath(provider.id)}`,
    audience: `${appOrigin()}${samlMetadataPath(provider.id)}`,
    callbackUrl: samlCallbackUrl(provider.id),
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.never,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  });
}

export function buildServiceProviderMetadata(provider: SamlProvider): string {
  const saml = createSamlClient(provider);
  return saml.generateServiceProviderMetadata(null, null);
}

function profileEmail(profile: Profile, emailAttribute: string): string {
  const parsedProfile = v.safeParse(
    v.looseObject({
      nameID: v.optional(v.string()),
    }),
    profile,
  );
  const attributeValue = parsedProfile.success ? parsedProfile.output[emailAttribute] : undefined;
  const attributeEmail = v.safeParse(v.string(), attributeValue);
  if (attributeEmail.success && attributeEmail.output.includes('@')) {
    return attributeEmail.output;
  }
  const nameId = parsedProfile.success ? (parsedProfile.output.nameID ?? '') : '';
  return nameId.includes('@') ? nameId : '';
}

export async function completeSamlSignIn(
  provider: SamlProvider,
  profile: Profile,
): Promise<{ redirectTo: string; setCookie: string }> {
  const email = profileEmail(profile, provider.emailAttribute).toLowerCase();
  if (!email) {
    throw new Error('saml.assertion_invalid');
  }
  if (!emailMatchesAllowedDomains(email, provider.allowedEmailDomains)) {
    throw new Error('sso.email_domain_blocked');
  }

  const db = getDb();
  const name = profile.nameID ?? email;
  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let userId = existingUsers[0]?.id;
  if (!userId) {
    const inserted = await db
      .insert(users)
      .values({
        id: `user_${randomBytes(16).toString('hex')}`,
        name,
        email,
        emailVerified: true,
      })
      .returning();
    userId = inserted[0]?.id;
    if (!userId) {
      throw new Error('saml.assertion_invalid');
    }
  }

  const accountKey = profile.nameID ?? email;
  const existingAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, `saml_${provider.id}`)))
    .limit(1);
  if (!existingAccounts[0]) {
    await db.insert(accounts).values({
      id: `acc_${randomBytes(16).toString('hex')}`,
      accountId: accountKey,
      providerId: `saml_${provider.id}`,
      userId,
    });
  }

  const auth = getAuth();
  const context = await Promise.resolve(auth.$context);
  const session = await context.internalAdapter.createSession(userId);

  const cookieName = context.authCookies.sessionData.name;
  const secure = ENV.APP_ENV === 'production' ? '; Secure' : '';
  const setCookie = `${cookieName}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;

  return {
    redirectTo: `/w/${provider.workspaceId}`,
    setCookie,
  };
}
