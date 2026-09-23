import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getWebhookSubscriptionRow, toWebhookSubscriptionDto } from '~/server/utils/webhooks.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['webhooks'],
    summary: 'Get webhook subscription',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Webhook subscription',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookSubscriptionDto' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'webhook:read');
  const webhookId = requireParam(event, 'webhookId');
  return toWebhookSubscriptionDto(await getWebhookSubscriptionRow(ctx, webhookId, requestId));
});
