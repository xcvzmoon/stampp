import type { IdempotentResponseRecord, IdempotencyLookup } from '@stampp/shared';
import type { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import * as v from 'valibot';

const IN_PROGRESS_TTL_SECONDS = 60;

export type IdempotencyPrincipal =
  | { kind: 'token'; tokenHash: string }
  | { kind: 'address'; address: string };

export type IdempotencyScopeKey = string;

export function hashIdempotencyScope(principal: IdempotencyPrincipal): IdempotencyScopeKey {
  return principal.kind === 'token' ? `tok:${principal.tokenHash}` : `ip:${principal.address}`;
}

export function hashIdempotentRequest(
  method: string,
  path: string,
  bodyText: string | undefined,
): string {
  return createHash('sha256')
    .update(`${method}\n${path}\n${bodyText ?? ''}`)
    .digest('hex');
}

function idempotencyStoreKey(
  principal: IdempotencyPrincipal,
  method: string,
  path: string,
  key: string,
): string {
  return `stampp:idem:${hashIdempotencyScope(principal)}:${method}:${path}:${key}`;
}

function inProgressKey(storeKey: string): string {
  return `${storeKey}:in-progress`;
}

const idempotentRecordSchema = v.object({
  requestHash: v.string(),
  status: v.number(),
  body: v.string(),
  contentType: v.string(),
});

const storedEnvelopeSchema = v.variant('state', [
  v.object({ state: v.literal('in_progress') }),
  v.object({ state: v.literal('done'), record: idempotentRecordSchema }),
]);

export async function beginIdempotentRequest(
  redis: Redis,
  principal: IdempotencyPrincipal,
  method: string,
  path: string,
  key: string,
  requestHash: string,
): Promise<IdempotencyLookup> {
  const storeKey = idempotencyStoreKey(principal, method, path, key);
  const raw = await redis.get(storeKey);

  if (raw) {
    const parsed = parseEnvelope(raw);
    if (parsed?.state === 'done') {
      if (parsed.record.requestHash !== requestHash) {
        return { disposition: 'conflict' };
      }
      return { disposition: 'replay', record: parsed.record };
    }
    return { disposition: 'in_progress' };
  }

  const claimed = await redis.set(
    inProgressKey(storeKey),
    '1',
    'EX',
    IN_PROGRESS_TTL_SECONDS,
    'NX',
  );
  if (claimed !== 'OK') {
    return { disposition: 'in_progress' };
  }

  return { disposition: 'miss' };
}

export async function completeIdempotentRequest(
  redis: Redis,
  principal: IdempotencyPrincipal,
  method: string,
  path: string,
  key: string,
  record: IdempotentResponseRecord,
  ttlSeconds: number,
): Promise<void> {
  const storeKey = idempotencyStoreKey(principal, method, path, key);
  const envelope = { state: 'done' as const, record };
  const pipeline = redis.multi();
  pipeline.set(storeKey, JSON.stringify(envelope), 'EX', ttlSeconds);
  pipeline.del(inProgressKey(storeKey));
  await pipeline.exec();
}

export async function releaseIdempotentRequest(
  redis: Redis,
  principal: IdempotencyPrincipal,
  method: string,
  path: string,
  key: string,
): Promise<void> {
  const storeKey = idempotencyStoreKey(principal, method, path, key);
  await redis.del(inProgressKey(storeKey));
}

function parseEnvelope(raw: string) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = v.safeParse(storedEnvelopeSchema, decoded);
  return result.success ? result.output : null;
}
