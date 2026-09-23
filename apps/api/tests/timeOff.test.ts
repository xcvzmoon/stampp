import type { TimeOffRequest, TimeOffType } from '@stampp/database';
import { canTransitionTimeOff, countTimeOffDays, resolveTimeOffBalance } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { toTimeOffRequestDto, toTimeOffTypeDto } from '~/server/utils/timeOff.ts';

describe('time-off error status mapping', () => {
  it('maps overlap conflicts to 409', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_OFF_OVERLAP)).toBe(409);
  });

  it('maps transition, range, balance, and inactive type to 422', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_OFF_INVALID_TRANSITION)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_OFF_INVALID_RANGE)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_OFF_INSUFFICIENT_BALANCE)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_OFF_TYPE_INACTIVE)).toBe(422);
  });
});

function makeType(partial: Partial<TimeOffType> = {}): TimeOffType {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'tot_1',
    workspaceId: 'ws_1',
    name: 'Vacation',
    color: '#3B82F6',
    paid: true,
    annualAllowanceDays: '15.00',
    requiresApproval: true,
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function makeRequest(partial: Partial<TimeOffRequest> = {}): TimeOffRequest {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'tor_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    timeOffTypeId: 'tot_1',
    startDate: '2026-01-05',
    endDate: '2026-01-07',
    days: '3.00',
    status: 'pending',
    note: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

describe('time-off service helpers', () => {
  it('maps type allowance from numeric string', () => {
    expect(toTimeOffTypeDto(makeType()).annualAllowanceDays).toBe(15);
    expect(
      toTimeOffTypeDto(makeType({ annualAllowanceDays: null })).annualAllowanceDays,
    ).toBeNull();
  });

  it('maps request days and status', () => {
    const dto = toTimeOffRequestDto(makeRequest());
    expect(dto.days).toBe(3);
    expect(dto.status).toBe('pending');
    expect(dto.decidedAt).toBeNull();
  });

  it('supports pending approval transitions only', () => {
    expect(canTransitionTimeOff('approve', 'pending')).toBe(true);
    expect(canTransitionTimeOff('approve', 'approved')).toBe(false);
  });

  it('counts weekdays excluding holidays for balances', () => {
    expect(countTimeOffDays('2026-01-05', '2026-01-09')).toBe(5);
    expect(countTimeOffDays('2026-01-05', '2026-01-09', new Set(['2026-01-07']))).toBe(4);
    const balance = resolveTimeOffBalance({
      allowanceDays: 15,
      approvedDays: 4,
      pendingDays: 2,
    });
    expect(balance.remainingDays).toBe(9);
  });
});
