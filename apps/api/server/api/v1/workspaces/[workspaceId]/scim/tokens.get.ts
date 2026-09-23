import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listScimTokens } from '~/server/utils/scim.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'List SCIM tokens',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'SCIM tokens',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/ScimTokenDto' } },
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
          ScimTokenDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'prefix',
              'lastUsedAt',
              'revokedAt',
              'createdAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              prefix: { type: 'string' },
              lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
              revokedAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  return listScimTokens(ctx);
});
