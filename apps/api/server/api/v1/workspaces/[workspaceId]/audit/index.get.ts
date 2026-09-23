import { defineHandler, defineRouteMeta } from 'nitro';
import { listAuditEvents } from '~/server/utils/auditUi.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['audit'],
    summary: 'Browse workspace audit events',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'action', schema: { type: 'string' } },
      { in: 'query', name: 'entityType', schema: { type: 'string' } },
      { in: 'query', name: 'entityId', schema: { type: 'string' } },
      { in: 'query', name: 'actorUserId', schema: { type: 'string' } },
      { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
      { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
    ],
    responses: {
      200: {
        description: 'Audit events page',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items', 'nextCursor'],
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      action: { type: 'string' },
                      entityType: { type: 'string' },
                      entityId: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                nextCursor: { type: ['string', 'null'] },
              },
            },
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
          AuditRetentionDto: {
            type: 'object',
            required: ['workspaceId', 'retentionDays', 'updatedAt'],
            properties: {
              workspaceId: { type: 'string' },
              retentionDays: { type: 'integer' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'export:workspace');
  const params = event.url.searchParams;
  const query = {
    limit: Number(params.get('limit') ?? '50'),
    cursor: params.get('cursor') ?? undefined,
    action: params.get('action') ?? undefined,
    entityType: params.get('entityType') ?? undefined,
    entityId: params.get('entityId') ?? undefined,
    actorUserId: params.get('actorUserId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  };
  return listAuditEvents(ctx, query);
});
