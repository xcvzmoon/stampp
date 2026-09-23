import { describe, expect, it } from 'vite-plus/test';
import {
  assignmentCoversRange,
  isValidScheduleRange,
  isValidWeeklyHours,
  minutesToHours,
  resolveWorkload,
  DEFAULT_WEEKLY_CAPACITY_HOURS,
} from '../src/scheduling.ts';

describe('scheduling range rules', () => {
  it('validates inclusive calendar ranges', () => {
    expect(isValidScheduleRange('2026-01-05', '2026-01-05')).toBe(true);
    expect(isValidScheduleRange('2026-01-10', '2026-01-05')).toBe(false);
    expect(isValidScheduleRange('2026-13-01', '2026-13-02')).toBe(false);
  });

  it('validates weekly hours bounds', () => {
    expect(isValidWeeklyHours(40)).toBe(true);
    expect(isValidWeeklyHours(0)).toBe(false);
    expect(isValidWeeklyHours(169)).toBe(false);
    expect(DEFAULT_WEEKLY_CAPACITY_HOURS).toBe(40);
  });

  it('detects assignment overlap with a date range', () => {
    expect(assignmentCoversRange('2026-01-01', '2026-01-31', '2026-01-10', '2026-01-12')).toBe(
      true,
    );
    expect(assignmentCoversRange('2026-01-01', '2026-01-10', '2026-01-11', '2026-01-20')).toBe(
      false,
    );
  });
});

describe('workload resolution', () => {
  it('flags overbooking when schedule exceeds capacity', () => {
    const result = resolveWorkload({
      capacityHours: 40,
      scheduledHours: 50,
      trackedHours: 45,
    });
    expect(result.status).toBe('overbooked');
    expect(result.scheduleVarianceHours).toBe(5);
  });

  it('flags underutilization when tracked is well below schedule', () => {
    const result = resolveWorkload({
      capacityHours: 40,
      scheduledHours: 40,
      trackedHours: 8,
    });
    expect(result.status).toBe('underutilized');
    expect(result.capacityVarianceHours).toBe(32);
  });

  it('flags unscheduled when nothing is planned or tracked', () => {
    expect(resolveWorkload({ capacityHours: 40, scheduledHours: 0, trackedHours: 0 }).status).toBe(
      'unscheduled',
    );
  });

  it('treats healthy delivery as on track', () => {
    expect(
      resolveWorkload({ capacityHours: 40, scheduledHours: 40, trackedHours: 36 }).status,
    ).toBe('on_track');
  });

  it('converts minutes to hours with rounding', () => {
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(0)).toBe(0);
    expect(() => minutesToHours(-1)).toThrow(RangeError);
  });
});
