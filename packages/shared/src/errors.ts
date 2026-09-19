/** Stable wire codes. Clients switch on these, not on message text. */
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
  PROJECT_ARCHIVED: 'project.archived',
  PROJECT_NOT_ACTIVE: 'project.not_active',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  /** Matches server logs and the `x-request-id` header. */
  requestId: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
