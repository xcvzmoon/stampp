import { describe, expect, it } from 'vite-plus/test';
import { addMinutes, isValidDurationMinutes, minutesBetween } from '../src/duration.ts';

describe('minutesBetween', () => {
  it('computes whole minutes across a multi-hour span', () => {
    const start = new Date('2026-01-01T09:00:00.000Z');
    const end = new Date('2026-01-01T10:30:00.000Z');
    expect(minutesBetween(start, end)).toBe(90);
  });

  it('floors partial minutes below a full minute', () => {
    const start = new Date('2026-01-01T09:00:00.000Z');
    const end = new Date('2026-01-01T09:00:59.999Z');
    expect(minutesBetween(start, end)).toBe(0);
  });

  it('returns zero for identical instants', () => {
    const at = new Date('2026-01-01T09:00:00.000Z');
    expect(minutesBetween(at, at)).toBe(0);
  });

  it('crosses a UTC day boundary', () => {
    const start = new Date('2026-01-01T23:30:00.000Z');
    const end = new Date('2026-01-02T00:15:00.000Z');
    expect(minutesBetween(start, end)).toBe(45);
  });

  it('rejects inverted intervals', () => {
    const start = new Date('2026-01-01T10:00:00.000Z');
    const end = new Date('2026-01-01T09:00:00.000Z');
    expect(() => minutesBetween(start, end)).toThrow(RangeError);
  });
});

describe('addMinutes', () => {
  it('adds whole minutes to a start instant', () => {
    expect(addMinutes(new Date('2026-01-01T09:00:00.000Z'), 90)).toEqual(
      new Date('2026-01-01T10:30:00.000Z'),
    );
  });

  it('treats zero minutes as identity', () => {
    const start = new Date('2026-01-01T09:00:00.000Z');
    expect(addMinutes(start, 0)).toEqual(start);
  });

  it('rejects negative minutes', () => {
    expect(() => addMinutes(new Date('2026-01-01T09:00:00.000Z'), -1)).toThrow(RangeError);
  });

  it('rejects fractional minutes', () => {
    expect(() => addMinutes(new Date('2026-01-01T09:00:00.000Z'), 1.5)).toThrow(RangeError);
  });
});

describe('isValidDurationMinutes', () => {
  it('accepts non-negative integers', () => {
    expect(isValidDurationMinutes(0)).toBe(true);
    expect(isValidDurationMinutes(1440)).toBe(true);
  });

  it('rejects negatives, fractions, NaN, and Infinity', () => {
    expect(isValidDurationMinutes(-1)).toBe(false);
    expect(isValidDurationMinutes(1.5)).toBe(false);
    expect(isValidDurationMinutes(Number.NaN)).toBe(false);
    expect(isValidDurationMinutes(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
