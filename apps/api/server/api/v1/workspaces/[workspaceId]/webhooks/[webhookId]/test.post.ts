import { webhookTestInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createWebhookTestDelivery } from '~/server/utils/webhooks.ts';
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
    summary: 'Queue a test webhook delivery',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: false,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      202: {
        description: 'Queued test delivery',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookDeliveryDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'webhook:manage');
  const webhookId = requireParam(event, 'webhookId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(webhookTestInputSchema, body, requestId);
  const delivery = await createWebhookTestDelivery(ctx, webhookId, input, requestId);
  event.res.status = 202;
  return delivery;
});
