import type {
  DecideTimesheetInput,
  SubmitTimesheetInput,
  TimesheetListQuery,
  WithdrawTimesheetInput,
} from '@stampp/shared';
import type { ApiTransport, RequestOptions } from '../http.ts';
import { timesheetDtoSchema, timesheetListResultSchema } from '../schemas.ts';

export function createTimesheetsApi(transport: ApiTransport) {
  const root = () => `/api/v1/workspaces/${transport.workspaceId}`;

  return {
    list(query: Partial<TimesheetListQuery> = {}, options?: RequestOptions) {
      return transport.request(timesheetListResultSchema, 'GET', `${root()}/timesheets`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    submit(body: SubmitTimesheetInput, options?: RequestOptions) {
      return transport.request(timesheetDtoSchema, 'POST', `${root()}/timesheets/submit`, {
        ...options,
        body,
      });
    },
    withdraw(body: WithdrawTimesheetInput, options?: RequestOptions) {
      return transport.request(timesheetDtoSchema, 'POST', `${root()}/timesheets/withdraw`, {
        ...options,
        body,
      });
    },
    approve(timesheetId: string, body: DecideTimesheetInput, options?: RequestOptions) {
      return transport.request(
        timesheetDtoSchema,
        'POST',
        `${root()}/timesheets/${timesheetId}/approve`,
        { ...options, body },
      );
    },
    reject(timesheetId: string, body: DecideTimesheetInput, options?: RequestOptions) {
      return transport.request(
        timesheetDtoSchema,
        'POST',
        `${root()}/timesheets/${timesheetId}/reject`,
        { ...options, body },
      );
    },
  };
}
