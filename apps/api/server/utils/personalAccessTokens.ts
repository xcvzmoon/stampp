import type { PersonalAccessToken } from '@stampp/database';
import { personalAccessTokens } from '@stampp/database';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { getDb } from '~/server/utils/db.ts';

export type GeneratedPersonalAccessToken = {
  token: string;
  hash: string;
};

export function generatePersonalAccessToken(): GeneratedPersonalAccessToken {
  const token = `stpp_${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashPersonalAccessToken(token) };
}

export function hashPersonalAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function resolvePersonalAccessTokenUser(token: string): Promise<string | null> {
  if (!token.startsWith('stpp_')) {
    return null;
  }
  const db = getDb();
  const hash = hashPersonalAccessToken(token);
  const rows = await db
    .select()
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.tokenHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  await db
    .update(personalAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(personalAccessTokens.id, row.id));
  return row.userId;
}

export function isTokenActive(row: PersonalAccessToken): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export function assertWorkspaceToken(row: PersonalAccessToken, workspaceId: string): boolean {
  return row.workspaceId === workspaceId;
}

export function openTokenConditions(workspaceId: string, userId: string) {
  return and(
    eq(personalAccessTokens.workspaceId, workspaceId),
    eq(personalAccessTokens.userId, userId),
    isNull(personalAccessTokens.revokedAt),
  );
}
