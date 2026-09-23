/** Stable wire codes. Clients switch on these, not on message text. */
export const ERROR_CODES = {
  BAD_REQUEST: 'bad_request',
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  IDEMPOTENCY_KEY_CONFLICT: 'idempotency.key_conflict',
  IDEMPOTENCY_IN_PROGRESS: 'idempotency.in_progress',
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
  ATTENDANCE_ALREADY_OPEN: 'attendance.already_open',
  ATTENDANCE_NOT_OPEN: 'attendance.not_open',
  ATTENDANCE_INVALID_INTERVAL: 'attendance.invalid_interval',
  TIME_OFF_INVALID_TRANSITION: 'time_off.invalid_transition',
  TIME_OFF_INVALID_RANGE: 'time_off.invalid_range',
  TIME_OFF_INSUFFICIENT_BALANCE: 'time_off.insufficient_balance',
  TIME_OFF_TYPE_INACTIVE: 'time_off.type_inactive',
  TIME_OFF_OVERLAP: 'time_off.overlap',
  SCHEDULE_INVALID_RANGE: 'schedule.invalid_range',
  SCHEDULE_OVERBOOKED: 'schedule.overbooked',
  KIOSK_AUTH_FAILED: 'kiosk.auth_failed',
  KIOSK_DEVICE_REVOKED: 'kiosk.device_revoked',
  WEBHOOK_INVALID_URL: 'webhook.invalid_url',
  WEBHOOK_DELIVERY_FAILED: 'webhook.delivery_failed',
  ROLE_IN_USE: 'role.in_use',
  ROLE_INVALID_PERMISSIONS: 'role.invalid_permissions',
  SSO_PROVIDER_ID_TAKEN: 'sso.provider_id_taken',
  SSO_EMAIL_DOMAIN_BLOCKED: 'sso.email_domain_blocked',
  SAML_ASSERTION_INVALID: 'saml.assertion_invalid',
  SCIM_UNAUTHENTICATED: 'scim.unauthenticated',
  APPROVAL_INVALID_STEP: 'approval.invalid_step',
  APPROVAL_INVALID_CHAIN: 'approval.invalid_chain',
  APPROVAL_ALREADY_DECIDED: 'approval.already_decided',
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
