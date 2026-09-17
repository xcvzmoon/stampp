import * as v from 'valibot';

/**
 * Non-empty identifier, max 128 characters.
 *
 * @example
 * ```ts
 * v.safeParse(idSchema, 'te_01900000-0000-7000-8000-000000000001').success; // true
 * v.safeParse(idSchema, '').success; // false
 * ```
 */
export const idSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128));

/**
 * Three-letter ISO 4217 currency code (letters only).
 *
 * @example
 * ```ts
 * v.safeParse(currencySchema, 'USD').success; // true
 * v.safeParse(currencySchema, 'USDT').success; // false
 * ```
 */
export const currencySchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z]{3}$/, 'Must be a 3-letter ISO 4217 currency code'),
);

/**
 * Non-negative whole minutes.
 *
 * @example
 * ```ts
 * v.safeParse(minutesSchema, 90).success; // true
 * v.safeParse(minutesSchema, -1).success; // false
 * v.safeParse(minutesSchema, 1.5).success; // false
 * ```
 */
export const minutesSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

/**
 * ISO-8601 date-time string, for example `2026-01-01T09:00:00.000Z`.
 *
 * @example
 * ```ts
 * v.safeParse(isoDateSchema, '2026-01-01T09:00:00.000Z').success; // true
 * v.safeParse(isoDateSchema, '2026-01-01').success; // false
 * ```
 */
export const isoDateSchema = v.pipe(
  v.string(),
  v.isoTimestamp(() => 'Must be an ISO-8601 date-time string'),
);

/** ISO-8601 calendar date in `YYYY-MM-DD` form. */
export const calendarDateSchema = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO-8601 calendar date'),
  v.check((input) => {
    const date = new Date(`${input}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input;
  }, 'Must be a valid calendar date'),
);
