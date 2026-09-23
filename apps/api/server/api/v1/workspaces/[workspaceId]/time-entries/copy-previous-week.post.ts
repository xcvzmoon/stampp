import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { timeSchemas, validateCopyPreviousWeekInput } from '~/server/utils/time.ts';
import { copyPreviousWeek } from '~/server/utils/timeTracking.ts';
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
    tags: ['time-entries'],
    summary: 'Copy previous week entries',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['weekStart', 'timezone'],
            properties: {
              weekStart: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              timezone: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Copy result',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['copiedEntries'],
              properties: {
                copiedEntries: { type: 'integer', minimum: 0 },
              },
            },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: {
        description: 'Target week already contains entries',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const body = await readJsonBody(event, requestId);
  const parsed = parseBody(timeSchemas.copyPreviousWeek, body, requestId);
  const input = validateCopyPreviousWeekInput(parsed, requestId);
  return copyPreviousWeek(ctx, input, requestId);
});
