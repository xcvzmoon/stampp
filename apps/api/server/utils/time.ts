import type { CopyPreviousWeekInput, TimeEntryListQuery } from '@stampp/shared';
import {
  addManualTimeInputSchema,
  copyPreviousWeekInputSchema,
  ERROR_CODES,
  startTimerInputSchema,
  timeEntryListQuerySchema,
  updateTimeEntryInputSchema,
  weeklyTimeQuerySchema,
} from '@stampp/shared';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { requireMonday, requireTimezone } from '~/server/utils/week.ts';

export function parseTimeEntryListQuery(
  query: URLSearchParams,
  requestId: string,
): TimeEntryListQuery & { limit: number } {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'from', 'to', 'projectId']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(timeEntryListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  if (result.output.from && result.output.to && result.output.from > result.output.to) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'from must be before to', requestId);
  }
  return { ...result.output, limit: result.output.limit ?? 50 };
}

export const timeSchemas = {
  startTimer: startTimerInputSchema,
  addManual: addManualTimeInputSchema,
  updateEntry: updateTimeEntryInputSchema,
  copyPreviousWeek: copyPreviousWeekInputSchema,
} as const;

export function parseWeeklyTimeQuery(query: URLSearchParams, requestId: string) {
  const result = v.safeParse(weeklyTimeQuerySchema, {
    weekStart: query.get('weekStart'),
    timezone: query.get('timezone'),
  });
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  requireMonday(result.output.weekStart, requestId);
  requireTimezone(result.output.timezone, requestId);
  return result.output;
}

export function validateCopyPreviousWeekInput(
  input: CopyPreviousWeekInput,
  requestId: string,
): CopyPreviousWeekInput {
  requireMonday(input.weekStart, requestId);
  requireTimezone(input.timezone, requestId);
  return input;
}
