import type { H3Event } from 'nitro';
import type { IdempotencyPrincipal } from '~/server/utils/idempotency.ts';
import type { RateLimitPrincipal } from '~/server/utils/rateLimit.ts';
import { ERROR_CODES, IDEMPOTENCY_HEADERS, RATE_LIMIT_HEADERS } from '@stampp/shared';
import { defineMiddleware } from 'nitro';
import { ensureRequestId, toApiError } from '~/server/middleware/request-id.ts';
import { readCachedBodyText } from '~/server/utils/bodyCache.ts';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  hashIdempotentRequest,
  releaseIdempotentRequest,
} from '~/server/utils/idempotency.ts';
import {
  consumeRateLimit,
  hashCredential,
  resolveRateLimitPrincipal,
  retryAfterSeconds,
} from '~/server/utils/rateLimit.ts';
import { getIdempotencyTtlSeconds, getRateLimitRpm, getValkey } from '~/server/utils/valkey.ts';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type IdempotencyEventState = {
  principal: IdempotencyPrincipal;
  key: string;
  path: string;
  method: string;
  requestHash: string;
};

/** Minimal event shape shared by Nitro middleware and runtime hooks. */
export type IdempotencyEventRef = {
  req: { headers: Headers };
};

const idempotencyStates = new WeakMap<IdempotencyEventRef, IdempotencyEventState>();

export function readIdempotencyEventState(
  event: IdempotencyEventRef,
): IdempotencyEventState | undefined {
  return idempotencyStates.get(event);
}

function isApiV1Path(path: string): boolean {
  return path === '/api/v1' || path.startsWith('/api/v1/');
}

function resolveClientAddress(event: H3Event): string {
  const forwarded = event.req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = event.req.headers.get('x-real-ip')?.trim();
  return realIp === undefined || realIp === '' ? 'unknown' : realIp;
}

function bearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function toIdempotencyPrincipal(
  authorization: string | null,
  address: string,
): IdempotencyPrincipal {
  const token = bearerToken(authorization);
  if (token) {
    return { kind: 'token', tokenHash: hashCredential(token) };
  }
  return { kind: 'address', address };
}

export default defineMiddleware(async (event, next) => {
  const pathname = event.url.pathname;
  if (!isApiV1Path(pathname)) {
    return next();
  }

  const requestId = ensureRequestId(event);
  const redis = getValkey();
  const authorization = event.req.headers.get('authorization');
  const address = resolveClientAddress(event);
  const ratePrincipal: RateLimitPrincipal = resolveRateLimitPrincipal(authorization, address);

  const decision = await consumeRateLimit(redis, ratePrincipal, getRateLimitRpm());
  event.res.headers.set(RATE_LIMIT_HEADERS.limit, String(decision.snapshot.limit));
  event.res.headers.set(RATE_LIMIT_HEADERS.remaining, String(decision.snapshot.remaining));
  event.res.headers.set(RATE_LIMIT_HEADERS.reset, String(decision.snapshot.resetAt));

  if (!decision.allowed) {
    event.res.headers.set(
      RATE_LIMIT_HEADERS.retryAfter,
      String(retryAfterSeconds(decision.snapshot)),
    );
    throw toApiError(ERROR_CODES.RATE_LIMITED, 'Rate limit exceeded', requestId, {
      limit: decision.snapshot.limit,
      resetAt: decision.snapshot.resetAt,
    });
  }

  const method = event.req.method.toUpperCase();
  const idempotencyKey = event.req.headers.get(IDEMPOTENCY_HEADERS.key);
  if (!idempotencyKey || !MUTATING_METHODS.has(method)) {
    return next();
  }

  const path = event.url.pathname;
  const contentType = event.req.headers.get('content-type') ?? '';
  let bodyText: string | undefined;
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    bodyText = await readCachedBodyText(event);
  }

  const principal = toIdempotencyPrincipal(authorization, address);
  const requestHash = hashIdempotentRequest(method, path, bodyText);
  const lookup = await beginIdempotentRequest(
    redis,
    principal,
    method,
    path,
    idempotencyKey,
    requestHash,
  );

  if (lookup.disposition === 'replay') {
    return new Response(lookup.record.body, {
      status: lookup.record.status,
      headers: {
        'content-type': lookup.record.contentType,
        [IDEMPOTENCY_HEADERS.replayed]: 'true',
        'x-request-id': requestId,
      },
    });
  }

  if (lookup.disposition === 'conflict') {
    throw toApiError(
      ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
      'Idempotency-Key was already used with a different request payload',
      requestId,
    );
  }

  if (lookup.disposition === 'in_progress') {
    throw toApiError(
      ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
      'A request with this Idempotency-Key is still in progress',
      requestId,
    );
  }

  idempotencyStates.set(event, {
    principal,
    key: idempotencyKey,
    path,
    method,
    requestHash,
  });

  try {
    return await next();
  } catch (error) {
    await releaseIdempotentRequest(redis, principal, method, path, idempotencyKey);
    throw error;
  }
});

export async function storeIdempotentResponse(
  event: IdempotencyEventRef,
  response: Response,
): Promise<void> {
  const state = readIdempotencyEventState(event);
  if (!state) {
    return;
  }

  // 5xx must not be stored so clients can retry after an outage.
  if (response.status >= 500) {
    await releaseIdempotentRequest(
      getValkey(),
      state.principal,
      state.method,
      state.path,
      state.key,
    );
    return;
  }

  const contentType = response.headers.get('content-type') ?? 'application/json';
  const body = await response.clone().text();
  await completeIdempotentRequest(
    getValkey(),
    state.principal,
    state.method,
    state.path,
    state.key,
    {
      requestHash: state.requestHash,
      status: response.status,
      body,
      contentType,
    },
    getIdempotencyTtlSeconds(),
  );
  response.headers.set(IDEMPOTENCY_HEADERS.stored, 'true');
}
