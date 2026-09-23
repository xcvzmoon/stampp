import { updateTimeOffTypeInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateTimeOffType } from '~/server/utils/timeOff.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Update time-off type',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
      { in: 'path', name: 'typeId', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              color: { type: ['string', 'null'] },
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
      200: {
        description: 'Updated time-off type',
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
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:manage');
  const typeId = requireParam(event, 'typeId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateTimeOffTypeInputSchema, body, requestId);
  return updateTimeOffType(ctx, typeId, input, requestId);
});
