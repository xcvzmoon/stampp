import { webhookDeliveryListQuerySchema, webhookEventTypeSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listWebhookDeliveries } from '~/server/utils/webhooks.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['webhooks'],
    summary: 'List webhook delivery attempts',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'status',
        schema: { type: 'string', enum: ['pending', 'success', 'failed', 'dead'] },
      },
      { in: 'query', name: 'event', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Delivery log',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookDeliveryList' },
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
  const query = parseListQuery(event.url.searchParams, requestId);
  void webhookDeliveryListQuerySchema;
  const statusRaw = event.url.searchParams.get('status');
  const status =
    statusRaw === 'pending' ||
    statusRaw === 'success' ||
    statusRaw === 'failed' ||
    statusRaw === 'dead'
      ? statusRaw
      : undefined;
  const eventRaw = event.url.searchParams.get('event');
  const eventResult = eventRaw ? v.safeParse(webhookEventTypeSchema, eventRaw) : null;
  return listWebhookDeliveries(
    ctx,
    webhookId,
    {
      limit: query.limit,
      cursor: query.cursor,
      status,
      event: eventResult?.success ? eventResult.output : undefined,
    },
    requestId,
  );
});
