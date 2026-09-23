import type { ApiError } from '@stampp/shared';

export class StamppApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, error: ApiError, retryAfterSeconds: number | null) {
    super(error.message);
    this.name = 'StamppApiError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isStamppApiError(error: unknown): error is StamppApiError {
  return error instanceof StamppApiError;
}
