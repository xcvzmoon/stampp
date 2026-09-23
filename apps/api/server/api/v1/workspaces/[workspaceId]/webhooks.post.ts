import { createWebhookSubscriptionInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createWebhookSubscription } from '~/server/utils/webhooks.ts';
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
    tags: ['webhooks'],
    summary: 'Create webhook subscription (secret returned once)',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['url', 'events'],
            properties: {
              url: { type: 'string', minLength: 1 },
              description: { type: 'string', maxLength: 200 },
              events: { type: 'array', items: { type: 'string' }, minItems: 1 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created subscription with signing secret',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['secret', 'subscription'],
              properties: {
                secret: { type: 'string' },
                subscription: { $ref: '#/components/schemas/WebhookSubscriptionDto' },
              },
            },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      422: {
        description: 'Webhook URL rejected',
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
  const ctx = await requireWorkspace(event, 'webhook:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createWebhookSubscriptionInputSchema, body, requestId);
  const created = await createWebhookSubscription(ctx, input, requestId);
  event.res.status = 201;
  return created;
});
