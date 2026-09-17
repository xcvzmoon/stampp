import { ERROR_CODES } from '@stampp/shared';
import { toApiError } from '~/server/middleware/request-id.ts';

const calendarDateFormatterByTimezone = new Map<string, Intl.DateTimeFormat>();

function calendarDateFormatter(timezone: string): Intl.DateTimeFormat {
  const existing = calendarDateFormatterByTimezone.get(timezone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  calendarDateFormatterByTimezone.set(timezone, formatter);
  return formatter;
}

export function calendarDateInTimezone(date: Date, timezone: string): string {
  const parts = calendarDateFormatter(timezone).formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
  }
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function requireMonday(date: string, requestId: string): void {
  if (new Date(`${date}T00:00:00.000Z`).getUTCDay() !== 1) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'weekStart must be a Monday', requestId);
  }
}

export function requireTimezone(timezone: string, requestId: string): void {
  try {
    calendarDateFormatter(timezone).format(new Date(0));
  } catch {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'timezone must be a valid IANA timezone', requestId);
  }
}
