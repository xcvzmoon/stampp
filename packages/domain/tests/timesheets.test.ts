import { describe, expect, it } from 'vite-plus/test';
import { canTransition, isTimesheetFrozen, nextStatus } from '../src/timesheets.ts';

describe('timesheet transitions', () => {
  it('allows submit from draft and rejected', () => {
    expect(canTransition('submit', null)).toBe(true);
    expect(canTransition('submit', 'rejected')).toBe(true);
    expect(canTransition('submit', 'submitted')).toBe(false);
    expect(canTransition('submit', 'approved')).toBe(false);
  });

  it('allows withdraw only from submitted', () => {
    expect(canTransition('withdraw', 'submitted')).toBe(true);
    expect(canTransition('withdraw', null)).toBe(false);
    expect(canTransition('withdraw', 'approved')).toBe(false);
    expect(canTransition('withdraw', 'rejected')).toBe(false);
  });

  it('allows approve and reject only from submitted', () => {
    expect(canTransition('approve', 'submitted')).toBe(true);
    expect(canTransition('reject', 'submitted')).toBe(true);
    expect(canTransition('approve', 'approved')).toBe(false);
    expect(canTransition('reject', 'rejected')).toBe(false);
    expect(canTransition('approve', null)).toBe(false);
  });

  it('maps actions to stored statuses', () => {
    expect(nextStatus('submit')).toBe('submitted');
    expect(nextStatus('approve')).toBe('approved');
    expect(nextStatus('reject')).toBe('rejected');
    expect(() => nextStatus('withdraw')).toThrow(RangeError);
  });

  it('freezes submitted and approved weeks only', () => {
    expect(isTimesheetFrozen(null)).toBe(false);
    expect(isTimesheetFrozen('rejected')).toBe(false);
    expect(isTimesheetFrozen('submitted')).toBe(true);
    expect(isTimesheetFrozen('approved')).toBe(true);
  });
});
