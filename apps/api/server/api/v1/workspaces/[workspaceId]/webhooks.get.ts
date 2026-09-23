import { webhookListQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listWebhookSubscriptions } from '~/server/utils/webhooks.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['webhooks'],
    summary: 'List webhook subscriptions',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'disabled'] } },
    ],
    responses: {
      200: {
        description: 'Workspace webhook subscriptions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookSubscriptionList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          WebhookSubscriptionDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'url',
              'description',
              'events',
              'status',
              'secretPrefix',
              'lastDeliveryAt',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              url: { type: 'string' },
              description: { type: ['string', 'null'] },
              events: { type: 'array', items: { type: 'string' } },
              status: { type: 'string', enum: ['active', 'disabled'] },
              secretPrefix: { type: 'string' },
              lastDeliveryAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          WebhookSubscriptionList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/WebhookSubscriptionDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          WebhookDeliveryDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'webhookId',
              'event',
              'eventId',
              'status',
              'attemptCount',
              'lastStatusCode',
              'lastError',
              'nextAttemptAt',
              'createdAt',
              'completedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              webhookId: { type: 'string' },
              event: { type: 'string' },
              eventId: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'success', 'failed', 'dead'] },
              attemptCount: { type: 'integer' },
              lastStatusCode: { type: ['integer', 'null'] },
              lastError: { type: ['string', 'null'] },
              nextAttemptAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              completedAt: { type: ['string', 'null'], format: 'date-time' },
            },
          },
          WebhookDeliveryList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/WebhookDeliveryDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'webhook:read');
  const query = parseListQuery(event.url.searchParams, getRequestId(event));
  const statusRaw = event.url.searchParams.get('status');
  const status = statusRaw === 'active' || statusRaw === 'disabled' ? statusRaw : undefined;
  void webhookListQuerySchema;
  return listWebhookSubscriptions(ctx, {
    limit: query.limit,
    cursor: query.cursor,
    status,
  });
});
