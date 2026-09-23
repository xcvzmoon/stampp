import { describe, expect, it } from 'vite-plus/test';
import {
  assertValidAttendanceInterval,
  attendanceDurationMinutes,
  attendanceState,
  canClockIn,
  canClockOut,
  isOpenAttendance,
} from '../src/attendance.ts';

describe('attendance punch rules', () => {
  it('allows clock-in only when no open record exists', () => {
    expect(canClockIn(false)).toBe(true);
    expect(canClockIn(true)).toBe(false);
  });

  it('allows clock-out only when a record is open', () => {
    expect(canClockOut(true)).toBe(true);
    expect(canClockOut(false)).toBe(false);
  });

  it('derives open and closed state from clock-out', () => {
    expect(attendanceState(null)).toBe('open');
    expect(isOpenAttendance(null)).toBe(true);
    expect(attendanceState(new Date())).toBe('closed');
    expect(isOpenAttendance(new Date())).toBe(false);
  });

  it('measures closed punches between clock-in and clock-out', () => {
    const clockInAt = new Date('2026-01-01T09:00:00.000Z');
    const clockOutAt = new Date('2026-01-01T17:30:00.000Z');
    expect(attendanceDurationMinutes(clockInAt, clockOutAt)).toBe(510);
  });

  it('measures open punches against now', () => {
    const clockInAt = new Date('2026-01-01T09:00:00.000Z');
    const now = new Date('2026-01-01T12:00:00.000Z');
    expect(attendanceDurationMinutes(clockInAt, null, now)).toBe(180);
  });

  it('rejects clock-out at or before clock-in', () => {
    const clockInAt = new Date('2026-01-01T09:00:00.000Z');
    expect(() => {
      assertValidAttendanceInterval(clockInAt, clockInAt);
    }).toThrow(RangeError);
    expect(() => {
      assertValidAttendanceInterval(clockInAt, new Date('2026-01-01T08:59:00.000Z'));
    }).toThrow(RangeError);
    expect(() => {
      assertValidAttendanceInterval(clockInAt, null);
    }).not.toThrow();
    expect(() => {
      assertValidAttendanceInterval(clockInAt, new Date('2026-01-01T09:01:00.000Z'));
    }).not.toThrow();
  });
});
