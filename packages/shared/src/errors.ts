/**
 * Stable API error codes. Clients switch on these, not on message text.
 *
 * @example
 * ```ts
 * if (error.code === ERROR_CODES.TIME_ENTRY_OVERLAP) {
 *   // show overlap UI
 * }
 * ```
 */
export const ERROR_CODES = {
  BAD_REQUEST: 'bad_request',
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal',
  TIME_ENTRY_OVERLAP: 'time_entry.overlap',
  TIME_ENTRY_LOCKED: 'time_entry.locked',
  TIMER_ALREADY_RUNNING: 'timer.already_running',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Wire format for failed product API responses.
 *
 * `requestId` ties the response to server logs and the `x-request-id` header.
 *
 * @example
 * ```ts
 * const body: ApiError = {
 *   code: ERROR_CODES.TIME_ENTRY_OVERLAP,
 *   message: 'Time entry overlaps an existing entry',
 *   requestId: '01900000-0000-7000-8000-000000000001',
 * };
 * ```
 */
export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
};

/**
 * Discriminated result for handlers that return domain errors without throwing.
 *
 * @example
 * ```ts
 * function readEntry(id: string): ApiResult<TimeEntry> {
 *   const entry = find(id);
 *   if (!entry) {
 *     return {
 *       ok: false,
 *       error: {
 *         code: ERROR_CODES.NOT_FOUND,
 *         message: 'Time entry not found',
 *         requestId,
 *       },
 *     };
 *   }
 *   return { ok: true, data: entry };
 * }
 * ```
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
