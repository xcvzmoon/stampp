import { describe, expect, it } from 'vite-plus/test';
import {
  canTransitionTimeOff,
  countTimeOffDays,
  hasSufficientBalance,
  isValidTimeOffRange,
  nextTimeOffStatus,
  resolveTimeOffBalance,
} from '../src/timeOff.ts';

describe('time-off transitions', () => {
  it('allows withdraw, approve, and reject only from pending', () => {
    expect(canTransitionTimeOff('withdraw', 'pending')).toBe(true);
    expect(canTransitionTimeOff('approve', 'pending')).toBe(true);
    expect(canTransitionTimeOff('reject', 'pending')).toBe(true);
    expect(canTransitionTimeOff('approve', 'approved')).toBe(false);
    expect(canTransitionTimeOff('reject', 'rejected')).toBe(false);
    expect(canTransitionTimeOff('withdraw', 'canceled')).toBe(false);
  });

  it('maps actions to stored statuses', () => {
    expect(nextTimeOffStatus('withdraw')).toBe('canceled');
    expect(nextTimeOffStatus('approve')).toBe('approved');
    expect(nextTimeOffStatus('reject')).toBe('rejected');
  });
});

describe('time-off range and day count', () => {
  it('validates inclusive ranges', () => {
    expect(isValidTimeOffRange('2026-01-05', '2026-01-05')).toBe(true);
    expect(isValidTimeOffRange('2026-01-10', '2026-01-05')).toBe(false);
    expect(isValidTimeOffRange('2026-13-01', '2026-13-02')).toBe(false);
  });

  it('counts weekdays only', () => {
    // Mon 2026-01-05 .. Fri 2026-01-09
    expect(countTimeOffDays('2026-01-05', '2026-01-09')).toBe(5);
    // Sat 2026-01-10 .. Sun 2026-01-11
    expect(countTimeOffDays('2026-01-10', '2026-01-11')).toBe(0);
  });

  it('excludes holiday dates', () => {
    const holidays = new Set(['2026-01-07']);
    expect(countTimeOffDays('2026-01-05', '2026-01-09', holidays)).toBe(4);
  });

  it('rejects inverted ranges', () => {
    expect(() => countTimeOffDays('2026-01-10', '2026-01-05')).toThrow(RangeError);
  });
});

describe('time-off balances', () => {
  it('computes remaining days when allowance is set', () => {
    const balance = resolveTimeOffBalance({
      allowanceDays: 15,
      approvedDays: 4,
      pendingDays: 2,
    });
    expect(balance.usedDays).toBe(6);
    expect(balance.remainingDays).toBe(9);
    expect(hasSufficientBalance(balance, 9)).toBe(true);
    expect(hasSufficientBalance(balance, 10)).toBe(false);
  });

  it('treats null allowance as unlimited', () => {
    const balance = resolveTimeOffBalance({
      allowanceDays: null,
      approvedDays: 100,
      pendingDays: 10,
    });
    expect(balance.remainingDays).toBeNull();
    expect(hasSufficientBalance(balance, 50)).toBe(true);
  });
});
