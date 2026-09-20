export type BudgetAlertLevel = 'none' | 'warning' | 'exceeded';

export type BudgetUsage = {
  usedMinutes: number;
  budgetMinutes: number | null;
  usedAmountMinor: number;
  budgetAmountMinor: number | null;
  currency: string | null;
  alertAtPercent: number;
  hoursLevel: BudgetAlertLevel;
  moneyLevel: BudgetAlertLevel;
  hoursRatio: number | null;
  moneyRatio: number | null;
};

export function usageRatio(used: number, budget: number | null): number | null {
  if (budget === null || budget <= 0) return null;
  return used / budget;
}

export function usageLevel(
  used: number,
  budget: number | null,
  alertAtPercent: number,
): BudgetAlertLevel {
  const ratio = usageRatio(used, budget);
  if (ratio === null) return 'none';
  if (ratio >= 1) return 'exceeded';
  if (ratio >= alertAtPercent / 100) return 'warning';
  return 'none';
}

export function resolveBudgetUsage(input: {
  usedMinutes: number;
  budgetMinutes: number | null;
  usedAmountMinor: number;
  budgetAmountMinor: number | null;
  currency: string | null;
  alertAtPercent: number;
}): BudgetUsage {
  const alertAtPercent = input.alertAtPercent > 0 ? input.alertAtPercent : 80;
  return {
    usedMinutes: input.usedMinutes,
    budgetMinutes: input.budgetMinutes,
    usedAmountMinor: input.usedAmountMinor,
    budgetAmountMinor: input.budgetAmountMinor,
    currency: input.currency,
    alertAtPercent,
    hoursLevel: usageLevel(input.usedMinutes, input.budgetMinutes, alertAtPercent),
    moneyLevel: usageLevel(input.usedAmountMinor, input.budgetAmountMinor, alertAtPercent),
    hoursRatio: usageRatio(input.usedMinutes, input.budgetMinutes),
    moneyRatio: usageRatio(input.usedAmountMinor, input.budgetAmountMinor),
  };
}
