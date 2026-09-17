import type { TimeEntryListQuery } from '@stampp/shared';
import {
  addManualTimeInputSchema,
  ERROR_CODES,
  startTimerInputSchema,
  timeEntryListQuerySchema,
  updateTimeEntryInputSchema,
} from '@stampp/shared';
import * as v from 'valibot';
import { toApiError } from '../middleware/request-id.ts';

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
} as const;
