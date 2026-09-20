import { describe, expect, it } from 'vite-plus/test';
import {
  computeMargin,
  computeUtilization,
  hoursFromMinutes,
  revenueFromHours,
} from '../src/advancedReports.ts';

describe('advanced reports domain', () => {
  it('computes profit margin from revenue cost and expenses', () => {
    const margin = computeMargin({
      revenueMinor: 100_000,
      laborCostMinor: 40_000,
      expenseMinor: 10_000,
    });
    expect(margin.profitMinor).toBe(50_000);
    expect(margin.marginRatio).toBeCloseTo(0.5);
  });

  it('returns null margin ratio without revenue', () => {
    const margin = computeMargin({
      revenueMinor: 0,
      laborCostMinor: 1_000,
      expenseMinor: 0,
    });
    expect(margin.profitMinor).toBe(-1_000);
    expect(margin.marginRatio).toBeNull();
  });

  it('computes utilization from billable vs total minutes', () => {
    const util = computeUtilization(480, 360);
    expect(util.nonBillableMinutes).toBe(120);
    expect(util.utilizationRatio).toBeCloseTo(0.75);
  });

  it('returns null utilization without tracked time', () => {
    expect(computeUtilization(0, 0).utilizationRatio).toBeNull();
  });

  it('converts hours and applies rates', () => {
    expect(hoursFromMinutes(90)).toBe(1.5);
    expect(revenueFromHours(2, 12_500)).toBe(25_000);
  });
});
