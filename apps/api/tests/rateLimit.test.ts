import type { RateLimitRedis } from '~/server/utils/rateLimit.ts';
import { describe, expect, it } from 'vite-plus/test';
import { hashIdempotentRequest } from '~/server/utils/idempotency.ts';
import {
  consumeRateLimit,
  hashCredential,
  resolveRateLimitPrincipal,
  retryAfterSeconds,
  windowStartFor,
} from '~/server/utils/rateLimit.ts';

function createFakeRedis(): RateLimitRedis & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    incr(key: string) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve(next);
    },
    pexpire(_key: string, _ttl: number) {
      return Promise.resolve(1);
    },
  };
}

describe('rate limit primitives', () => {
  it('prefers bearer credentials and windows by clock', () => {
    const principal = resolveRateLimitPrincipal('Bearer stpp_abc', '203.0.113.10');
    expect(principal.kind).toBe('token');
    if (principal.kind === 'token') {
      expect(principal.tokenHash).toBe(hashCredential('stpp_abc'));
    }
    expect(resolveRateLimitPrincipal(null, '203.0.113.10')).toEqual({
      kind: 'address',
      address: '203.0.113.10',
    });
    expect(windowStartFor(90_000)).toBe(60_000);
  });

  it('blocks after the limit and reports retry-after', async () => {
    const redis = createFakeRedis();
    const principal = { kind: 'address' as const, address: '203.0.113.10' };
    const now = 1_700_000_000_000;

    const first = await consumeRateLimit(redis, principal, 2, now);
    expect(first.allowed).toBe(true);
    const second = await consumeRateLimit(redis, principal, 2, now);
    expect(second.allowed).toBe(true);
    const third = await consumeRateLimit(redis, principal, 2, now);
    expect(third.allowed).toBe(false);
    if (!third.allowed) {
      expect(third.snapshot.remaining).toBe(0);
      expect(retryAfterSeconds(third.snapshot, now)).toBeGreaterThan(0);
    }
  });

  it('fingerprints method, path, and body', () => {
    const a = hashIdempotentRequest('POST', '/api/v1/workspaces/w/tags', '{"name":"a"}');
    const b = hashIdempotentRequest('POST', '/api/v1/workspaces/w/tags', '{"name":"a"}');
    const c = hashIdempotentRequest('POST', '/api/v1/workspaces/w/tags', '{"name":"b"}');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
