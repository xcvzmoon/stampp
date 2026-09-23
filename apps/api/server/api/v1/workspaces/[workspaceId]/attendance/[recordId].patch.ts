import { updateAttendanceInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { updateAttendance } from '~/server/utils/attendance.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['attendance'],
    summary: 'Update attendance record',
    description: 'Correct clock times or notes for an attendance punch.',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'recordId', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              clockInAt: { type: 'string', format: 'date-time' },
              clockOutAt: { type: ['string', 'null'], format: 'date-time' },
              timezone: { type: 'string' },
              note: { type: ['string', 'null'], maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated attendance record',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AttendanceDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Opening a punch would create a second open punch',
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
  const ctx = await requireWorkspace(event, 'attendance:read:own');
  const recordId = requireParam(event, 'recordId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateAttendanceInputSchema, body, requestId);
  return updateAttendance(ctx, recordId, input, requestId);
});
