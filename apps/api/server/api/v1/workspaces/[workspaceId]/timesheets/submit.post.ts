import { submitTimesheetInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { submitTimesheet } from '~/server/utils/timesheets.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timesheets'],
    summary: 'Submit own timesheet for the week',
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
              note: { type: 'string', maxLength: 2000 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Submitted timesheet',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimesheetDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
      422: {
        description: 'Invalid transition or empty week',
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
  const input = parseBody(submitTimesheetInputSchema, body, requestId);
  return submitTimesheet(ctx, input, requestId);
});
