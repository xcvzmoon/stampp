import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listSsoProviders } from '~/server/utils/sso.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['sso'],
    summary: 'List workspace OIDC providers',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'OIDC providers',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/SsoProviderDto' } },
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
          SsoProviderDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'providerId',
              'name',
              'issuer',
              'clientId',
              'scopes',
              'allowedEmailDomains',
              'status',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              providerId: { type: 'string' },
              name: { type: 'string' },
              issuer: { type: 'string' },
              clientId: { type: 'string' },
              scopes: { type: 'array', items: { type: 'string' } },
              allowedEmailDomains: { type: 'array', items: { type: 'string' } },
              status: { type: 'string', enum: ['enabled', 'disabled'] },
              createdAt: { type: 'string', format: 'date-time' },
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
  const ctx = await requireWorkspace(event, 'settings:manage');
  return listSsoProviders(ctx);
});
