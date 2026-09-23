import { createTimeOffTypeInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createTimeOffType } from '~/server/utils/timeOff.ts';
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
    tags: ['time-off'],
    summary: 'Create time-off type',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 80 },
              color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
              paid: { type: 'boolean' },
              annualAllowanceDays: { type: ['number', 'null'] },
              requiresApproval: { type: 'boolean' },
              active: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created time-off type',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffTypeDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createTimeOffTypeInputSchema, body, requestId);
  const row = await createTimeOffType(ctx, input, requestId);
  event.res.status = 201;
  return row;
});
