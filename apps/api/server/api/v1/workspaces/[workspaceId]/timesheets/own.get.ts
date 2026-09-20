import { ERROR_CODES, calendarDateSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getOwnTimesheetState } from '~/server/utils/timesheets.ts';
import { requireMonday } from '~/server/utils/week.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timesheets'],
    summary: 'Get own timesheet state for a week',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'weekStart',
        required: true,
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    ],
    responses: {
      200: {
        description: 'Own timesheet state',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OwnTimesheetState' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:read:own');
  const weekStart = event.url.searchParams.get('weekStart');
  const parsed = v.safeParse(calendarDateSchema, weekStart);
  if (!parsed.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'weekStart is required',
      requestId,
      parsed.issues,
    );
  }
  requireMonday(parsed.output, requestId);
  return getOwnTimesheetState(ctx, parsed.output, requestId);
});
