export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'canceled';

export type TimeOffAction = 'withdraw' | 'approve' | 'reject';

const ALLOWED: Record<TimeOffAction, ReadonlySet<TimeOffStatus>> = {
  withdraw: new Set<TimeOffStatus>(['pending']),
  approve: new Set<TimeOffStatus>(['pending']),
  reject: new Set<TimeOffStatus>(['pending']),
};

export function canTransitionTimeOff(action: TimeOffAction, current: TimeOffStatus): boolean {
  return ALLOWED[action].has(current);
}

export function nextTimeOffStatus(action: TimeOffAction): TimeOffStatus {
  switch (action) {
    case 'withdraw':
      return 'canceled';
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    default: {
      const exhaustive: never = action;
      throw new RangeError(`Unknown action: ${String(exhaustive)}`);
    }
  }
}

/** Days that still hold balance (pending + approved). */
export function countsTowardBalance(status: TimeOffStatus): boolean {
  return status === 'pending' || status === 'approved';
}

export function isValidTimeOffRange(startDate: string, endDate: string): boolean {
  return isValidCalendarDate(startDate) && isValidCalendarDate(endDate) && startDate <= endDate;
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Inclusive day count from startDate..endDate, excluding weekends.
 * Holidays are passed as calendar-date strings and also excluded.
 */
export function countTimeOffDays(
  startDate: string,
  endDate: string,
  holidayDates: ReadonlySet<string> = new Set(),
): number {
  if (!isValidTimeOffRange(startDate, endDate)) {
    throw new RangeError('endDate must be on or after startDate');
  }

  let days = 0;
  let cursor = startDate;
  // Guard against pathological ranges (years of requests).
  let guard = 0;
  while (cursor <= endDate) {
    const weekday = new Date(`${cursor}T00:00:00.000Z`).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    if (!isWeekend && !holidayDates.has(cursor)) {
      days += 1;
    }
    const next = new Date(`${cursor}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
    guard += 1;
    if (guard > 3660) {
      throw new RangeError('Time off range is too long');
    }
  }
  return days;
}

export type TimeOffBalanceInput = {
  allowanceDays: number | null;
  approvedDays: number;
  pendingDays: number;
};

export type TimeOffBalance = {
  allowanceDays: number | null;
  approvedDays: number;
  pendingDays: number;
  usedDays: number;
  remainingDays: number | null;
};

export function resolveTimeOffBalance(input: TimeOffBalanceInput): TimeOffBalance {
  const usedDays = input.approvedDays + input.pendingDays;
  if (input.allowanceDays === null) {
    return {
      allowanceDays: null,
      approvedDays: input.approvedDays,
      pendingDays: input.pendingDays,
      usedDays,
      remainingDays: null,
    };
  }
  return {
    allowanceDays: input.allowanceDays,
    approvedDays: input.approvedDays,
    pendingDays: input.pendingDays,
    usedDays,
    remainingDays: input.allowanceDays - usedDays,
  };
}

export function hasSufficientBalance(balance: TimeOffBalance, requestedDays: number): boolean {
  if (balance.remainingDays === null) return true;
  return balance.remainingDays >= requestedDays;
}
