import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';

describe('timesheet error status mapping', () => {
  it('maps invalid transition and empty week to 422', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIMESHEET_INVALID_TRANSITION)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIMESHEET_EMPTY)).toBe(422);
  });

  it('maps frozen timesheet to 423', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIMESHEET_FROZEN)).toBe(423);
  });
});
