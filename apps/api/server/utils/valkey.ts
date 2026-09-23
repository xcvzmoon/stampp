import type { Redis } from 'ioredis';
import { createValkeyConnection } from '@stampp/mailer';
import { ENV } from '~/server/utils/env.ts';

let client: Redis | undefined;

/** Shared Valkey connection for rate limiting and idempotency storage. */
export function getValkey(): Redis {
  return (client ??= createValkeyConnection(ENV.VALKEY_URL));
}

export async function closeValkey(): Promise<void> {
  if (!client) {
    return;
  }
  const current = client;
  client = undefined;
  await current.quit().catch(() => {
    current.disconnect();
  });
}

export function getRateLimitRpm(): number {
  return ENV.RATE_LIMIT_RPM;
}

export function getIdempotencyTtlSeconds(): number {
  return ENV.IDEMPOTENCY_TTL_SECONDS;
}
