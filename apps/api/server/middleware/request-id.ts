import type { ApiError } from '@stampp/shared';
import { defineHandler, HTTPError } from 'nitro';
import { v7 as uuidv7 } from 'uuid';
import { buildApiError, mapErrorCodeToStatus } from '../utils/errors.ts';

export function resolveRequestId(headers: Headers): string {
  return headers.get('x-request-id') ?? uuidv7();
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
  event.context.requestId = requestId;
  event.res.headers.set('x-request-id', requestId);
});
