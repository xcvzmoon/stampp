import type { MemberCapacity, ProjectAssignment } from '@stampp/database';
import { isValidScheduleRange, resolveWorkload } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { toAssignmentDto, toCapacityDto } from '~/server/utils/scheduling.ts';

describe('scheduling error status mapping', () => {
  it('maps invalid range to 422 and overbook to 409', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.SCHEDULE_INVALID_RANGE)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.SCHEDULE_OVERBOOKED)).toBe(409);
  });
});

function makeCapacity(partial: Partial<MemberCapacity> = {}): MemberCapacity {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'mcap_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    weeklyHours: '40.00',
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function makeAssignment(partial: Partial<ProjectAssignment> = {}): ProjectAssignment {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'pas_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    projectId: 'prj_1',
    startDate: '2026-01-05',
    endDate: '2026-01-30',
    hoursPerWeek: '20.00',
    note: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

describe('scheduling service helpers', () => {
  it('maps capacity and assignment numeric strings', () => {
    expect(toCapacityDto(makeCapacity()).weeklyHours).toBe(40);
    expect(toAssignmentDto(makeAssignment()).hoursPerWeek).toBe(20);
    expect(toAssignmentDto(makeAssignment()).active).toBe(true);
  });

  it('validates schedule ranges', () => {
    expect(isValidScheduleRange('2026-01-05', '2026-01-09')).toBe(true);
    expect(isValidScheduleRange('2026-01-09', '2026-01-05')).toBe(false);
  });

  it('resolves workload status flags', () => {
    expect(
      resolveWorkload({ capacityHours: 40, scheduledHours: 48, trackedHours: 40 }).status,
    ).toBe('overbooked');
    expect(
      resolveWorkload({ capacityHours: 40, scheduledHours: 40, trackedHours: 10 }).status,
    ).toBe('underutilized');
  });
});
