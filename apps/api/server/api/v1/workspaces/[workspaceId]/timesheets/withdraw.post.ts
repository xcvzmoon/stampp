import { withdrawTimesheetInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { withdrawTimesheet } from '~/server/utils/timesheets.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timesheets'],
    summary: 'Withdraw own submitted timesheet',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['weekStart'],
            properties: {
              weekStart: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            },
          },
        },
      },
    },
    responses: {
      204: { description: 'Withdrawn' },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Invalid transition',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(withdrawTimesheetInputSchema, body, requestId);
  await withdrawTimesheet(ctx, input, requestId);
  event.res.status = 204;
  return null;
});
