import { createAttendanceInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { createAttendance } from '~/server/utils/attendance.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['attendance'],
    summary: 'Create attendance record',
    description: 'Manual attendance entry for managers (missed punches or corrections).',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['clockInAt', 'timezone'],
            properties: {
              userId: { type: 'string' },
              clockInAt: { type: 'string', format: 'date-time' },
              clockOutAt: { type: ['string', 'null'], format: 'date-time' },
              timezone: { type: 'string' },
              note: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created attendance record',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AttendanceDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: {
        description: 'Target user already has an open punch',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      422: {
        description: 'Invalid attendance interval',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'attendance:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createAttendanceInputSchema, body, requestId);
  const record = await createAttendance(ctx, input, requestId);
  event.res.status = 201;
  return record;
});
