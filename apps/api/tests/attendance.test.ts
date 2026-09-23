import type { AttendanceRecord } from '@stampp/database';
import { attendanceDurationMinutes, canClockIn, canClockOut } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { toAttendanceDto } from '~/server/utils/attendance.ts';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';

function makeRecord(partial: Partial<AttendanceRecord> = {}): AttendanceRecord {
  const clockInAt = new Date('2026-01-01T09:00:00.000Z');
  return {
    id: 'at_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    clockInAt,
    clockOutAt: null,
    durationMinutes: null,
    workDate: '2026-01-01',
    timezone: 'UTC',
    source: 'clock',
    note: null,
    createdAt: clockInAt,
    updatedAt: clockInAt,
    deletedAt: null,
    ...partial,
  };
}

describe('attendance error status mapping', () => {
  it('maps open/not-open conflicts to 409', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.ATTENDANCE_ALREADY_OPEN)).toBe(409);
    expect(mapErrorCodeToStatus(ERROR_CODES.ATTENDANCE_NOT_OPEN)).toBe(409);
  });

  it('maps invalid interval to 422', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.ATTENDANCE_INVALID_INTERVAL)).toBe(422);
  });
});

describe('attendance service helpers', () => {
  it('derives open state and elapsed minutes for the current punch', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    const dto = toAttendanceDto(makeRecord(), now);
    expect(dto.state).toBe('open');
    expect(dto.clockOutAt).toBeNull();
    expect(dto.durationMinutes).toBe(180);
  });

  it('stores closed duration from the row', () => {
    const dto = toAttendanceDto(
      makeRecord({
        clockOutAt: new Date('2026-01-01T17:00:00.000Z'),
        durationMinutes: 480,
      }),
    );
    expect(dto.state).toBe('closed');
    expect(dto.durationMinutes).toBe(480);
  });

  it('guards clock transitions', () => {
    expect(canClockIn(false)).toBe(true);
    expect(canClockIn(true)).toBe(false);
    expect(canClockOut(true)).toBe(true);
    expect(canClockOut(false)).toBe(false);
  });

  it('measures intervals with the domain helper', () => {
    expect(
      attendanceDurationMinutes(
        new Date('2026-01-01T09:00:00.000Z'),
        new Date('2026-01-01T10:00:00.000Z'),
      ),
    ).toBe(60);
  });
});
