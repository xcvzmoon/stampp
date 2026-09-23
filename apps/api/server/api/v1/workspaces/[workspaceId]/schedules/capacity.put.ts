import { upsertCapacityInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { upsertCapacity } from '~/server/utils/scheduling.ts';
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
    tags: ['scheduling'],
    summary: 'Upsert weekly capacity',
    description: 'Members set their own capacity; managers may set any member via userId.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['weeklyHours'],
            properties: {
              userId: { type: 'string' },
              weeklyHours: { type: 'number', minimum: 0.5, maximum: 168 },
              note: { type: ['string', 'null'], maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Saved capacity',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CapacityDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
      422: {
        description: 'Invalid capacity hours',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'schedule:read:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(upsertCapacityInputSchema, body, requestId);
  return upsertCapacity(ctx, input, requestId);
});
