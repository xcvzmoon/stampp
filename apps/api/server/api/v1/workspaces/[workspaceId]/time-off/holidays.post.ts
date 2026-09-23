import { createHolidayInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createHoliday } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Create holiday',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'date'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 80 },
              date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created holiday',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HolidayDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createHolidayInputSchema, body, requestId);
  const row = await createHoliday(ctx, input, requestId);
  event.res.status = 201;
  return row;
});
