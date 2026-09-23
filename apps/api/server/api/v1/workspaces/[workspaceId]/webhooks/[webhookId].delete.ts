import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { deleteWebhookSubscription } from '~/server/utils/webhooks.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['webhooks'],
    summary: 'Delete webhook subscription',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      204: { description: 'Deleted' },
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
  await deleteWebhookSubscription(ctx, webhookId, requestId);
  event.res.status = 204;
  return null;
});
