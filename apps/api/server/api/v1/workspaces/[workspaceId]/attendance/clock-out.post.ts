import type { JsonValue } from '~/server/utils/catalog.ts';
import { clockOutInputSchema } from '@stampp/shared';
import { useLogger } from 'evlog/nitro/v3';
import { defineHandler, defineRouteMeta } from 'nitro';
import { clockOut } from '~/server/utils/attendance.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['attendance'],
    summary: 'Clock out',
    description: "Closes the caller's open attendance punch.",
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              note: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Closed attendance punch',
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
        description: 'Not clocked in',
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
  const ctx = await requireWorkspace(event, 'attendance:write:own');
  const contentLength = event.req.headers.get('content-length');
  let raw: JsonValue = {};
  if (contentLength && contentLength !== '0') {
    raw = await readJsonBody(event, requestId);
  }
  const input = parseBody(clockOutInputSchema, raw, requestId);
  const record = await clockOut(ctx, input, requestId);
  useLogger(event).set({
    action: 'attendance.clock_out',
    attendance: { id: record.id, durationMinutes: record.durationMinutes },
  });
  return record;
});
