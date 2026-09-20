export type TimesheetStatus = 'submitted' | 'approved' | 'rejected';

export type TimesheetAction = 'submit' | 'withdraw' | 'approve' | 'reject';

/**
 * Allowed transitions from a stored status (null = draft / no row).
 * reject returns to an editable draft state for the member.
 */
const ALLOWED: Record<TimesheetAction, ReadonlySet<TimesheetStatus | null>> = {
  submit: new Set<TimesheetStatus | null>([null, 'rejected']),
  withdraw: new Set<TimesheetStatus | null>(['submitted']),
  approve: new Set<TimesheetStatus | null>(['submitted']),
  reject: new Set<TimesheetStatus | null>(['submitted']),
};

export function canTransition(action: TimesheetAction, current: TimesheetStatus | null): boolean {
  return ALLOWED[action].has(current);
}

export function nextStatus(action: TimesheetAction): TimesheetStatus {
  switch (action) {
    case 'submit':
      return 'submitted';
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'withdraw':
      throw new RangeError('withdraw returns to draft, not a stored status');
    default: {
      const exhaustive: never = action;
      throw new RangeError(`Unknown action: ${String(exhaustive)}`);
    }
  }
}

/** True when the member must not edit time in the week. */
export function isTimesheetFrozen(status: TimesheetStatus | null): boolean {
  return status === 'submitted' || status === 'approved';
}
