import { updateWebhookSubscriptionInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateWebhookSubscription } from '~/server/utils/webhooks.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
      },
    ],
    tags: ['webhooks'],
    summary: 'Get or update webhook subscription',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      200: {
        description: 'Updated webhook subscription',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookSubscriptionDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
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
  const webhookId = requireParam(event, 'webhookId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateWebhookSubscriptionInputSchema, body, requestId);
  return updateWebhookSubscription(ctx, webhookId, input, requestId);
});
