/** Wire contracts for public `/api/v1` platform headers and replay records. */

export const RATE_LIMIT_HEADERS = {
  limit: 'x-ratelimit-limit',
  remaining: 'x-ratelimit-remaining',
  reset: 'x-ratelimit-reset',
  retryAfter: 'retry-after',
} as const;

export const IDEMPOTENCY_HEADERS = {
  key: 'idempotency-key',
  replayed: 'idempotency-replayed',
  stored: 'idempotency-stored',
} as const;

export type RateLimitSnapshot = {
  /** Max requests allowed in the current window. */
  limit: number;
  /** Requests still available in the current window. */
  remaining: number;
  /** Unix seconds when the current window resets. */
  resetAt: number;
};

export type IdempotentResponseRecord = {
  /** SHA-256 of method + path + request fingerprint. */
  requestHash: string;
  status: number;
  body: string;
  contentType: string;
};

export type IdempotencyDisposition = 'miss' | 'replay' | 'in_progress' | 'conflict';

export type IdempotencyLookup =
  | { disposition: 'miss' }
  | { disposition: 'in_progress' }
  | { disposition: 'conflict' }
  | { disposition: 'replay'; record: IdempotentResponseRecord };
