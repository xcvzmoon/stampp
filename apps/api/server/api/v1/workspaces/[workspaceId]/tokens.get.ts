import { defineHandler, defineRouteMeta } from 'nitro';
import { listPersonalAccessTokens } from '~/server/utils/personalAccessTokenService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tokens'],
    summary: 'List own personal access tokens',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Personal access tokens',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PersonalAccessTokenDto' },
                },
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
          PersonalAccessTokenDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'name',
              'lastUsedAt',
              'expiresAt',
              'revokedAt',
              'createdAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              name: { type: 'string' },
              lastUsedAt: { type: ['string', 'null'] },
              expiresAt: { type: ['string', 'null'] },
              revokedAt: { type: ['string', 'null'] },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'project:read');
  const items = await listPersonalAccessTokens(ctx);
  return { items };
});
