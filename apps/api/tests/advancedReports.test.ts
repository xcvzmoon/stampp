import { computeMargin, computeUtilization } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';

describe('advanced reports api helpers', () => {
  it('uses domain margin math for report totals', () => {
    const margin = computeMargin({
      revenueMinor: 50_000,
      laborCostMinor: 20_000,
      expenseMinor: 5_000,
    });
    expect(margin.profitMinor).toBe(25_000);
  });

  it('uses domain utilization math', () => {
    expect(computeUtilization(240, 60).utilizationRatio).toBeCloseTo(0.25);
  });

  it('keeps report validation failures on 400', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.VALIDATION_FAILED)).toBe(400);
    expect(mapErrorCodeToStatus(ERROR_CODES.BAD_REQUEST)).toBe(400);
  });
});
