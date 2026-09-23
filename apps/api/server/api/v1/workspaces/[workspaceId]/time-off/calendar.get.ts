import { ERROR_CODES, timeOffCalendarQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getTimeOffCalendar } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Team time-off calendar',
    description: 'Holidays plus pending and approved leave for each day in the range.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'from',
        required: true,
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      {
        in: 'query',
        name: 'to',
        required: true,
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    ],
    responses: {
      200: {
        description: 'Calendar days',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffCalendarResult' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      422: {
        description: 'Invalid time-off transition or range',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:read:own');
  const raw: Record<string, string> = {};
  const from = event.url.searchParams.get('from');
  const to = event.url.searchParams.get('to');
  if (from !== null) raw.from = from;
  if (to !== null) raw.to = to;
  const parsed = v.safeParse(timeOffCalendarQuerySchema, raw);
  if (!parsed.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'from and to are required',
      requestId,
      parsed.issues,
    );
  }
  return getTimeOffCalendar(ctx, parsed.output, requestId);
});
