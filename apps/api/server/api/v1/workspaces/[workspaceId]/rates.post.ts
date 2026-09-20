import { createRateInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createRate } from '~/server/utils/rates.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['rates'],
    summary: 'Create rate version',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['kind', 'scope', 'amountMinor', 'currency', 'effectiveFrom'],
            properties: {
              kind: { type: 'string', enum: ['billable', 'cost'] },
              scope: {
                type: 'string',
                enum: ['org', 'user', 'project', 'user_project', 'task'],
              },
              userId: { type: ['string', 'null'] },
              projectId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
              amountMinor: { type: 'integer', minimum: 0 },
              currency: { type: 'string', minLength: 3, maxLength: 3 },
              effectiveFrom: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created rate version',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RateDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
      422: {
        description: 'Invalid rate target or currency mismatch',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createRateInputSchema, body, requestId);
  const rate = await createRate(ctx, input, requestId);
  event.res.status = 201;
  return rate;
});
