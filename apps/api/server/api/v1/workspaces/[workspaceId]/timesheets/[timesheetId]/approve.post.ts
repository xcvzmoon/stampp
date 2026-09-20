import { decideTimesheetInputSchema, type JsonValue } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { approveTimesheet } from '~/server/utils/timesheets.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timesheets'],
    summary: 'Approve submitted timesheet and lock week entries',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'timesheetId', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              note: { type: 'string', maxLength: 2000 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Approved timesheet',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimesheetDto' },
          },
        },
      },
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
  const ctx = await requireWorkspace(event, 'time:approve');
  const timesheetId = requireParam(event, 'timesheetId');
  const contentLength = event.req.headers.get('content-length');
  let body: JsonValue = {};
  if (contentLength && contentLength !== '0') {
    body = await readJsonBody(event, requestId);
  }
  const input = parseBody(decideTimesheetInputSchema, body, requestId);
  return approveTimesheet(ctx, timesheetId, input, requestId);
});
