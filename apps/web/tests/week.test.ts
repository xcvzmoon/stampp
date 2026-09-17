import { describe, expect, it } from 'vite-plus/test';
import {
  addCalendarDays,
  calendarDateInTimezone,
  formatMinutes,
  mondayForDate,
  parseDuration,
} from '../app/utils/week.ts';

describe('weekly calendar helpers', () => {
  it('finds Monday across month and year boundaries', () => {
    expect(mondayForDate('2026-01-01')).toBe('2025-12-29');
    expect(mondayForDate('2026-09-20')).toBe('2026-09-14');
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('uses the requested timezone at opposite sides of the date line', () => {
    const instant = new Date('2026-09-20T16:30:00.000Z');
    expect(calendarDateInTimezone(instant, 'Asia/Manila')).toBe('2026-09-21');
    expect(calendarDateInTimezone(instant, 'America/Los_Angeles')).toBe('2026-09-20');
  });
});

describe('duration input', () => {
  it('accepts clock and decimal hours', () => {
    expect(parseDuration('7:30')).toBe(450);
    expect(parseDuration('7.5')).toBe(450);
    expect(parseDuration('0:05')).toBe(5);
    expect(parseDuration('')).toBe(0);
  });

  it('rejects malformed and out-of-range clock values', () => {
    for (const value of ['1:60', '-1', 'one hour', '1:5', '1.234']) {
      expect(parseDuration(value)).toBeNull();
    }
  });

  it('formats totals without dropping minutes', () => {
    expect(formatMinutes(0)).toBe('0:00');
    expect(formatMinutes(1501)).toBe('25:01');
  });
});
