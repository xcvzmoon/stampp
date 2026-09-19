import * as v from 'valibot';

export const idSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128));

export const currencySchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z]{3}$/, 'Must be a 3-letter ISO 4217 currency code'),
);

export const minutesSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export const isoDateSchema = v.pipe(
  v.string(),
  v.isoTimestamp(() => 'Must be an ISO-8601 date-time string'),
);

export const calendarDateSchema = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO-8601 calendar date'),
  v.check((input) => {
    const date = new Date(`${input}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input;
  }, 'Must be a valid calendar date'),
);
