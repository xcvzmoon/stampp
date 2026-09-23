import { minutesBetween } from './duration.ts';

export type AttendanceRecordState = 'open' | 'closed';

export function attendanceState(clockOutAt: Date | null): AttendanceRecordState {
  return clockOutAt === null ? 'open' : 'closed';
}

export function isOpenAttendance(clockOutAt: Date | null): boolean {
  return clockOutAt === null;
}

export function canClockIn(hasOpenRecord: boolean): boolean {
  return !hasOpenRecord;
}

export function canClockOut(hasOpenRecord: boolean): boolean {
  return hasOpenRecord;
}

/**
 * Elapsed minutes for a punch. Open records measure from clock-in to `now`.
 */
export function attendanceDurationMinutes(
  clockInAt: Date,
  clockOutAt: Date | null,
  now: Date = new Date(),
): number {
  const end = clockOutAt ?? now;
  return minutesBetween(clockInAt, end);
}

export function assertValidAttendanceInterval(clockInAt: Date, clockOutAt: Date | null): void {
  if (clockOutAt !== null && clockOutAt.getTime() <= clockInAt.getTime()) {
    throw new RangeError('clockOutAt must be after clockInAt');
  }
}
