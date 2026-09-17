import type { ApiError } from '@stampp/shared';
import { defineHandler, HTTPError, type H3Event } from 'nitro';
import { v7 as uuidv7 } from 'uuid';
import { buildApiError, mapErrorCodeToStatus } from '~/server/utils/errors.ts';

const requestIds = new WeakMap<object, string>();

export function resolveRequestId(headers: Headers): string {
  return headers.get('x-request-id') ?? uuidv7();
}

export function readEventRequestId(event: H3Event): string {
  return requestIds.get(event) ?? 'unknown';
}

export function toApiError(
  code: string,
  message: string,
  requestId: string,
  details?: ApiError['details'],
): HTTPError {
  return new HTTPError({
    status: mapErrorCodeToStatus(code),
    message,
    data: buildApiError(code, message, requestId, details),
  });
}

export default defineHandler((event) => {
  const requestId = resolveRequestId(event.req.headers);
  requestIds.set(event, requestId);
  event.res.headers.set('x-request-id', requestId);
});
