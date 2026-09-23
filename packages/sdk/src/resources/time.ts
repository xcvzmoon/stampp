import type {
  AddManualTimeInput,
  CopyPreviousWeekInput,
  StartTimerInput,
  TimeEntryListQuery,
  UpdateTimeEntryInput,
  WeeklyTimeQuery,
} from '@stampp/shared';
import type { ApiTransport, RequestOptions } from '../http.ts';
import * as v from 'valibot';
import {
  copyPreviousWeekResultSchema,
  timeEntryDtoSchema,
  timeEntryListResultSchema,
  weeklyTimeSummarySchema,
} from '../schemas.ts';

const nullableTimerSchema = v.nullable(timeEntryDtoSchema);

export function createTimeApi(transport: ApiTransport) {
  const root = () => `/api/v1/workspaces/${transport.workspaceId}`;

  return {
    listEntries(query: Partial<TimeEntryListQuery> = {}, options?: RequestOptions) {
      return transport.request(timeEntryListResultSchema, 'GET', `${root()}/time-entries`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    createEntry(body: AddManualTimeInput, options?: RequestOptions) {
      return transport.request(timeEntryDtoSchema, 'POST', `${root()}/time-entries`, {
        ...options,
        body,
      });
    },
    updateEntry(entryId: string, body: UpdateTimeEntryInput, options?: RequestOptions) {
      return transport.request(timeEntryDtoSchema, 'PATCH', `${root()}/time-entries/${entryId}`, {
        ...options,
        body,
      });
    },
    deleteEntry(entryId: string, options?: RequestOptions) {
      return transport.requestEmpty('DELETE', `${root()}/time-entries/${entryId}`, options);
    },
    listWeekly(query: Partial<WeeklyTimeQuery>, options?: RequestOptions) {
      return transport.request(weeklyTimeSummarySchema, 'GET', `${root()}/time-entries/weekly`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    copyPreviousWeek(body: CopyPreviousWeekInput, options?: RequestOptions) {
      return transport.request(
        copyPreviousWeekResultSchema,
        'POST',
        `${root()}/time-entries/copy-previous-week`,
        { ...options, body },
      );
    },
    duplicateEntry(entryId: string, body: { date: string }, options?: RequestOptions) {
      return transport.request(
        timeEntryDtoSchema,
        'POST',
        `${root()}/time-entries/${entryId}/duplicate`,
        { ...options, body },
      );
    },

    getTimer(options?: RequestOptions) {
      return transport.request(nullableTimerSchema, 'GET', `${root()}/timer`, options);
    },
    startTimer(body: StartTimerInput, options?: RequestOptions) {
      return transport.request(timeEntryDtoSchema, 'POST', `${root()}/timer/start`, {
        ...options,
        body,
      });
    },
    stopTimer(entryId: string, options?: RequestOptions) {
      return transport.request(
        timeEntryDtoSchema,
        'POST',
        `${root()}/timer/${entryId}/stop`,
        options,
      );
    },
  };
}
