import { clockInInputSchema } from '@stampp/shared';
import { useLogger } from 'evlog/nitro/v3';
import { defineHandler, defineRouteMeta } from 'nitro';
import { clockIn } from '~/server/utils/attendance.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
    ],
    tags: ['attendance'],
    summary: 'Clock in',
    description:
      "Starts the caller's open attendance punch. One open punch per user per workspace.",
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['timezone'],
            properties: {
              timezone: { type: 'string' },
              note: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Started attendance punch',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AttendanceDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: {
        description: 'Already clocked in',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'attendance:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(clockInInputSchema, body, requestId);
  const record = await clockIn(ctx, input, requestId);
  useLogger(event).set({
    action: 'attendance.clock_in',
    attendance: { id: record.id, workDate: record.workDate },
  });
  event.res.status = 201;
  return record;
});
