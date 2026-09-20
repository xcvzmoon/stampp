export type MarginTotals = {
  revenueMinor: number;
  laborCostMinor: number;
  expenseMinor: number;
  profitMinor: number;
  marginRatio: number | null;
};

export type UtilizationTotals = {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  utilizationRatio: number | null;
};

export function computeMargin(input: {
  revenueMinor: number;
  laborCostMinor: number;
  expenseMinor: number;
}): MarginTotals {
  const profitMinor = input.revenueMinor - input.laborCostMinor - input.expenseMinor;
  return {
    revenueMinor: input.revenueMinor,
    laborCostMinor: input.laborCostMinor,
    expenseMinor: input.expenseMinor,
    profitMinor,
    marginRatio: input.revenueMinor > 0 ? profitMinor / input.revenueMinor : null,
  };
}

export function computeUtilization(
  totalMinutes: number,
  billableMinutes: number,
): UtilizationTotals {
  return {
    totalMinutes,
    billableMinutes,
    nonBillableMinutes: Math.max(0, totalMinutes - billableMinutes),
    utilizationRatio: totalMinutes > 0 ? billableMinutes / totalMinutes : null,
  };
}

export function hoursFromMinutes(minutes: number): number {
  return minutes / 60;
}

export function revenueFromHours(hours: number, unitAmountMinor: number): number {
  return Math.round(hours * unitAmountMinor);
}
