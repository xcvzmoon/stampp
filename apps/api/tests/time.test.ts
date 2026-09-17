import { ERROR_CODES } from '@stampp/shared';
import { HTTPError } from 'nitro';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '../server/utils/errors.ts';
import { parseTimeEntryListQuery } from '../server/utils/time.ts';

const requestId = 'req_time';

describe('parseTimeEntryListQuery', () => {
  it('applies the default limit and preserves supported filters', () => {
    const query = parseTimeEntryListQuery(
      new URLSearchParams({
        cursor: 'te_1',
        projectId: 'prj_1',
        from: '2026-09-01T00:00:00.000Z',
      }),
      requestId,
    );
    expect(query.limit).toBe(50);
    expect(query.cursor).toBe('te_1');
    expect(query.projectId).toBe('prj_1');
  });

  it('rejects inverted date ranges with a stable error code', () => {
    try {
      parseTimeEntryListQuery(
        new URLSearchParams({
          from: '2026-09-30T00:00:00.000Z',
          to: '2026-09-01T00:00:00.000Z',
        }),
        requestId,
      );
      throw new Error('expected date range rejection');
    } catch (error) {
      if (!(error instanceof HTTPError)) throw error;
      expect(error.status).toBe(400);
      expect(error.data).toMatchObject({ code: ERROR_CODES.BAD_REQUEST });
    }
  });
});

describe('time-entry error statuses', () => {
  it('maps concurrency and lock failures to distinct HTTP statuses', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIMER_ALREADY_RUNNING)).toBe(409);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_ENTRY_OVERLAP)).toBe(409);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_ENTRY_LOCKED)).toBe(423);
  });
});
