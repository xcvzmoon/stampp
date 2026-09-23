import { createTimeOffRequestInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createTimeOffRequest } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Request time off',
    description: 'Creates a pending request after counting weekdays and excluding holidays.',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['timeOffTypeId', 'startDate', 'endDate'],
            properties: {
              timeOffTypeId: { type: 'string' },
              startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              note: { type: 'string', maxLength: 2000 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Pending time-off request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffRequestDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Overlaps a pending request',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      422: {
        description: 'Invalid range, inactive type, or insufficient balance',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createTimeOffRequestInputSchema, body, requestId);
  const row = await createTimeOffRequest(ctx, input, requestId);
  event.res.status = 201;
  return row;
});
