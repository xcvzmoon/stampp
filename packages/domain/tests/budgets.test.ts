import { describe, expect, it } from 'vite-plus/test';
import { resolveBudgetUsage, usageLevel, usageRatio } from '../src/budgets.ts';

describe('budget usage', () => {
  it('returns null ratio when no budget is set', () => {
    expect(usageRatio(100, null)).toBeNull();
    expect(usageRatio(100, 0)).toBeNull();
  });

  it('classifies none, warning, and exceeded levels', () => {
    expect(usageLevel(50, 100, 80)).toBe('none');
    expect(usageLevel(80, 100, 80)).toBe('warning');
    expect(usageLevel(99, 100, 80)).toBe('warning');
    expect(usageLevel(100, 100, 80)).toBe('exceeded');
    expect(usageLevel(120, 100, 80)).toBe('exceeded');
  });

  it('defaults alert threshold to 80 when invalid', () => {
    const usage = resolveBudgetUsage({
      usedMinutes: 90,
      budgetMinutes: 100,
      usedAmountMinor: 0,
      budgetAmountMinor: null,
      currency: null,
      alertAtPercent: 0,
    });
    expect(usage.alertAtPercent).toBe(80);
    expect(usage.hoursLevel).toBe('warning');
  });

  it('resolves hours and money levels independently', () => {
    const usage = resolveBudgetUsage({
      usedMinutes: 20,
      budgetMinutes: 100,
      usedAmountMinor: 1_200_000,
      budgetAmountMinor: 1_000_000,
      currency: 'USD',
      alertAtPercent: 75,
    });
    expect(usage.hoursLevel).toBe('none');
    expect(usage.moneyLevel).toBe('exceeded');
    expect(usage.moneyRatio).toBe(1.2);
  });
});
