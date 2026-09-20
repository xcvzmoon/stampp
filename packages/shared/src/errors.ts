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
  RATE_INVALID_TARGET: 'rate.invalid_target',
  RATE_CURRENCY_MISMATCH: 'rate.currency_mismatch',
  RATE_NOT_REVOCABLE: 'rate.not_revocable',
  TIMESHEET_INVALID_TRANSITION: 'timesheet.invalid_transition',
  TIMESHEET_EMPTY: 'timesheet.empty',
  TIMESHEET_FROZEN: 'timesheet.frozen',
  STORAGE_NOT_CONFIGURED: 'storage.not_configured',
  INVOICE_INVALID_TRANSITION: 'invoice.invalid_transition',
  INVOICE_EMPTY: 'invoice.empty',
  INVOICE_OVERPAYMENT: 'invoice.overpayment',
  INVOICE_NOT_DRAFT: 'invoice.not_draft',
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
