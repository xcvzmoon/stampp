import type { RateLimitSnapshot } from '@stampp/shared';
import { createHash } from 'node:crypto';

export const RATE_LIMIT_WINDOW_MS = 60_000;

export type RateLimitPrincipal =
  | { kind: 'token'; tokenHash: string }
  | { kind: 'address'; address: string };

export type RateLimitRedis = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ttl: number): Promise<number>;
};

export type RateLimitDecision =
  | { allowed: true; snapshot: RateLimitSnapshot }
  | { allowed: false; snapshot: RateLimitSnapshot };

export function hashCredential(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export function resolveRateLimitPrincipal(
  authorization: string | null,
  address: string,
): RateLimitPrincipal {
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token.length > 0) {
      return { kind: 'token', tokenHash: hashCredential(token) };
    }
  }
  return { kind: 'address', address };
}

function rateLimitKey(principal: RateLimitPrincipal, windowStart: number): string {
  const id = principal.kind === 'token' ? `tok:${principal.tokenHash}` : `ip:${principal.address}`;
  return `stampp:rl:${id}:${windowStart}`;
}

export function windowStartFor(nowMs: number, windowMs = RATE_LIMIT_WINDOW_MS): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

/**
 * Fixed-window counter. Enough for credential abuse protection and cheap to reason about
 * when several API instances share one Valkey.
 */
export async function consumeRateLimit(
  redis: RateLimitRedis,
  principal: RateLimitPrincipal,
  limit: number,
  nowMs = Date.now(),
  windowMs = RATE_LIMIT_WINDOW_MS,
): Promise<RateLimitDecision> {
  const windowStart = windowStartFor(nowMs, windowMs);
  const key = rateLimitKey(principal, windowStart);
  const ttlMs = windowStart + windowMs - nowMs;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, Math.max(ttlMs, 1));
  }

  const snapshot: RateLimitSnapshot = {
    limit,
    remaining: Math.max(limit - count, 0),
    resetAt: Math.ceil((windowStart + windowMs) / 1000),
  };

  return count > limit ? { allowed: false, snapshot } : { allowed: true, snapshot };
}

export function retryAfterSeconds(snapshot: RateLimitSnapshot, nowMs = Date.now()): number {
  return Math.max(snapshot.resetAt - Math.ceil(nowMs / 1000), 1);
}
