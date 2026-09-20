import type { ApiError } from '@stampp/shared';
import { ERROR_CODES } from '@stampp/shared';

export function mapErrorCodeToStatus(code: string): number {
  if (code === ERROR_CODES.UNAUTHENTICATED) return 401;
  if (code === ERROR_CODES.FORBIDDEN) return 403;
  if (code === ERROR_CODES.NOT_FOUND) return 404;
  if (
    code === ERROR_CODES.CONFLICT ||
    code === ERROR_CODES.TIME_ENTRY_OVERLAP ||
    code === ERROR_CODES.TIMER_ALREADY_RUNNING
  ) {
    return 409;
  }
  if (
    code === ERROR_CODES.PROJECT_NOT_ACTIVE ||
    code === ERROR_CODES.PROJECT_ARCHIVED ||
    code === ERROR_CODES.RATE_INVALID_TARGET ||
    code === ERROR_CODES.RATE_CURRENCY_MISMATCH ||
    code === ERROR_CODES.RATE_NOT_REVOCABLE ||
    code === ERROR_CODES.TIMESHEET_INVALID_TRANSITION ||
    code === ERROR_CODES.TIMESHEET_EMPTY
  ) {
    return 422;
  }
  if (code === ERROR_CODES.TIME_ENTRY_LOCKED || code === ERROR_CODES.TIMESHEET_FROZEN) {
    return 423;
  }
  if (code === ERROR_CODES.STORAGE_NOT_CONFIGURED) {
    return 503;
  }
  if (code === ERROR_CODES.VALIDATION_FAILED) return 400;
  if (code === ERROR_CODES.BAD_REQUEST) return 400;
  if (code === ERROR_CODES.RATE_LIMITED) return 429;
  return 500;
}

export function buildApiError(
  code: string,
  message: string,
  requestId: string,
  details?: ApiError['details'],
): ApiError {
  return details === undefined
    ? { code, message, requestId }
    : { code, message, details, requestId };
}
