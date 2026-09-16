import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import { currencySchema, idSchema, isoDateSchema, minutesSchema } from '../src/schemas.ts';

describe('idSchema', () => {
  it('accepts a non-empty id', () => {
    expect(v.safeParse(idSchema, 'ws_01900000').success).toBe(true);
  });

  it('rejects empty ids', () => {
    expect(v.safeParse(idSchema, '').success).toBe(false);
  });

  it('rejects ids longer than 128 characters', () => {
    expect(v.safeParse(idSchema, 'x'.repeat(129)).success).toBe(false);
    expect(v.safeParse(idSchema, 'x'.repeat(128)).success).toBe(true);
  });

  it('rejects non-strings', () => {
    expect(v.safeParse(idSchema, 123).success).toBe(false);
    expect(v.safeParse(idSchema, null).success).toBe(false);
  });
});

describe('currencySchema', () => {
  it('accepts 3-letter codes', () => {
    expect(v.safeParse(currencySchema, 'USD').success).toBe(true);
    expect(v.safeParse(currencySchema, 'jpy').success).toBe(true);
  });

  it('rejects wrong length and non-alpha codes', () => {
    expect(v.safeParse(currencySchema, 'US').success).toBe(false);
    expect(v.safeParse(currencySchema, 'USDT').success).toBe(false);
    expect(v.safeParse(currencySchema, '123').success).toBe(false);
    expect(v.safeParse(currencySchema, '').success).toBe(false);
  });
});

describe('minutesSchema', () => {
  it('accepts non-negative integers including zero', () => {
    expect(v.safeParse(minutesSchema, 0).success).toBe(true);
    expect(v.safeParse(minutesSchema, 90).success).toBe(true);
  });

  it('rejects negatives, fractions, and non-numbers', () => {
    expect(v.safeParse(minutesSchema, -1).success).toBe(false);
    expect(v.safeParse(minutesSchema, 1.5).success).toBe(false);
    expect(v.safeParse(minutesSchema, '90').success).toBe(false);
  });
});

describe('isoDateSchema', () => {
  it('accepts ISO-8601 date-times with Z and offsets', () => {
    expect(v.safeParse(isoDateSchema, '2026-01-01T09:00:00.000Z').success).toBe(true);
    expect(v.safeParse(isoDateSchema, '2026-01-01T09:00:00Z').success).toBe(true);
    expect(v.safeParse(isoDateSchema, '2026-01-01T09:00:00.123+00:00').success).toBe(true);
  });

  it('rejects date-only and free-form strings', () => {
    expect(v.safeParse(isoDateSchema, '2026-01-01').success).toBe(false);
    expect(v.safeParse(isoDateSchema, 'not-a-date').success).toBe(false);
    expect(v.safeParse(isoDateSchema, '').success).toBe(false);
  });

  it('rejects out-of-range months and malformed timestamps', () => {
    expect(v.safeParse(isoDateSchema, '2026-13-01T09:00:00.000Z').success).toBe(false);
    expect(v.safeParse(isoDateSchema, '2026-01-01T25:00:00.000Z').success).toBe(false);
    expect(v.safeParse(isoDateSchema, '2026-01-01T09:00:00.000').success).toBe(false);
  });
});
