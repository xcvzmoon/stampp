import { ERROR_CODES, createRateInputSchema, resolveRatesQuerySchema } from '@stampp/shared';
import { HTTPError } from 'nitro';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { toRateDto } from '~/server/utils/rates.ts';

describe('createRateInputSchema', () => {
  it('accepts an org billable rate', () => {
    const result = v.safeParse(createRateInputSchema, {
      kind: 'billable',
      scope: 'org',
      amountMinor: 10000,
      currency: 'usd',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.currency).toBe('USD');
    }
  });

  it('rejects non-integer amounts', () => {
    const result = v.safeParse(createRateInputSchema, {
      kind: 'billable',
      scope: 'org',
      amountMinor: 10.5,
      currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amounts', () => {
    const result = v.safeParse(createRateInputSchema, {
      kind: 'cost',
      scope: 'user',
      userId: 'u1',
      amountMinor: -1,
      currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('resolveRatesQuerySchema', () => {
  it('accepts optional as-of and targets', () => {
    const result = v.safeParse(resolveRatesQuerySchema, {
      at: '2026-06-01T12:00:00.000Z',
      projectId: 'prj_1',
      taskId: 'tsk_1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid timestamps', () => {
    const result = v.safeParse(resolveRatesQuerySchema, { at: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

describe('toRateDto', () => {
  it('maps open and closed versions to ISO strings', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const base = {
      id: 'rate_1',
      workspaceId: 'ws_1',
      kind: 'billable' as const,
      scope: 'org' as const,
      userId: null,
      projectId: null,
      taskId: null,
      amountMinor: 5000,
      currency: 'USD',
      effectiveFrom: now,
      effectiveTo: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const open = toRateDto(base);
    expect(open.effectiveTo).toBeNull();
    expect(open.effectiveFrom).toBe(now.toISOString());

    const closed = toRateDto({ ...base, effectiveTo: now });
    expect(closed.effectiveTo).toBe(now.toISOString());
  });
});

describe('rate error status mapping', () => {
  it('maps rate business rules to 422', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.RATE_INVALID_TARGET)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.RATE_CURRENCY_MISMATCH)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.RATE_NOT_REVOCABLE)).toBe(422);
  });
});

describe('HTTPError shape for validation', () => {
  it('keeps validation failures as 400', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.VALIDATION_FAILED)).toBe(400);
    expect(HTTPError).toBeDefined();
  });
});
