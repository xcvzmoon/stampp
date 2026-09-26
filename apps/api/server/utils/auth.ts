import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import {
  accounts,
  auditEvents,
  invitations,
  members,
  organizations,
  sessions,
  twoFactors,
  users,
  verifications,
} from '@stampp/database';
import { betterAuth } from 'better-auth';
import { bearer, genericOAuth, organization, twoFactor } from 'better-auth/plugins';
import { getDb } from '~/server/utils/db.ts';
import { ENV } from '~/server/utils/env.ts';
import { getMailDispatch } from '~/server/utils/mailer.ts';
import { peekSsoConfigs, toGenericOAuthConfigs } from '~/server/utils/ssoStore.ts';

const schema = {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  members,
  invitations,
  twoFactors,
};

export type AuthEnv = {
  secret: string;
  baseURL: string;
};

export function resolveAuthEnv(
  env: {
    BETTER_AUTH_SECRET?: string | undefined;
    BETTER_AUTH_URL?: string | undefined;
    PUBLIC_APP_URL?: string | undefined;
  } = {
    BETTER_AUTH_SECRET: ENV.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: ENV.BETTER_AUTH_URL,
    PUBLIC_APP_URL: ENV.PUBLIC_APP_URL,
  },
): AuthEnv {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set to at least 32 characters');
  }

  const baseURL = env.BETTER_AUTH_URL ?? env.PUBLIC_APP_URL;
  if (!baseURL) {
    throw new Error('BETTER_AUTH_URL (or PUBLIC_APP_URL) is required');
  }

  return { secret, baseURL };
}

function resolveSocialProviders() {
  const googleId = ENV.GOOGLE_CLIENT_ID?.trim() ?? '';
  const googleSecret = ENV.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  const githubId = ENV.GITHUB_CLIENT_ID?.trim() ?? '';
  const githubSecret = ENV.GITHUB_CLIENT_SECRET?.trim() ?? '';
  const google =
    googleId && googleSecret ? { clientId: googleId, clientSecret: googleSecret } : undefined;
  const github =
    githubId && githubSecret ? { clientId: githubId, clientSecret: githubSecret } : undefined;
  return { google, github };
}

export function createAuth() {
  const env = resolveAuthEnv();
  const mail = getMailDispatch();
  const appUrl = ENV.PUBLIC_APP_URL ?? env.baseURL;
  const isProd = ENV.APP_ENV === 'production';
  const socialProviders = resolveSocialProviders();
  const ssoConfigs = toGenericOAuthConfigs(peekSsoConfigs());

  return betterAuth({
    appName: 'Stampp',
    secret: env.secret,
    baseURL: env.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [appUrl],
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      async sendResetPassword({ user, url }) {
        await mail.notify({
          type: 'auth.password-reset',
          email: user.email,
          resetUrl: url,
        });
      },
    },
    emailVerification: {
      async sendVerificationEmail({ user, url }) {
        if (!isProd) {
          console.info('[auth] verification link for %s: %s', user.email, url);
        }
        await mail.notify({
          type: 'auth.verify',
          email: user.email,
          verifyUrl: url,
        });
      },
    },
    socialProviders,
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      database: { joins: false },
      useSecureCookies: isProd,
    },
    plugins: [
      organization({
        teams: { enabled: false },
        allowUserToCreateOrganization: true,
        requireEmailVerificationOnInvitation: true,
        async sendInvitationEmail(data) {
          const inviteUrl = `${appUrl}/workspaces/invitations/accept?id=${data.id}`;
          await mail.notify({
            type: 'workspace.invite',
            email: data.email,
            inviterName: data.inviter.user.name,
            workspaceName: data.organization.name,
            inviteUrl,
          });
        },
        organizationHooks: {
          async afterCreateOrganization({ organization: org, member }) {
            await getDb().insert(auditEvents).values({
              workspaceId: org.id,
              actorUserId: member.userId,
              action: 'workspace.created',
              entityType: 'workspace',
              entityId: org.id,
              metadata: {},
            });
          },
        },
      }),
      twoFactor(),
      bearer(),
      genericOAuth({
        config: ssoConfigs,
      }),
    ],
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return (authInstance ??= createAuth());
}

/** Drop the cached auth app so SSO provider changes take effect. */
export function resetAuth(): void {
  authInstance = undefined;
}
