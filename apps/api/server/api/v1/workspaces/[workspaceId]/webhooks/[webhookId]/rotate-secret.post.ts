import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { rotateWebhookSecret } from '~/server/utils/webhooks.ts';
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
    summary: 'Rotate webhook signing secret (returned once)',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Rotated secret',
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
  return rotateWebhookSecret(ctx, webhookId, requestId);
});
