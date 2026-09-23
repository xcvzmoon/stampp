import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listSamlProviders } from '~/server/utils/saml.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['saml'],
    summary: 'List workspace SAML providers',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'SAML providers',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/SamlProviderDto' } },
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
          SamlProviderDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'entityId',
              'entryPoint',
              'emailAttribute',
              'allowedEmailDomains',
              'status',
              'metadataUrl',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              entityId: { type: 'string' },
              entryPoint: { type: 'string' },
              emailAttribute: { type: 'string' },
              allowedEmailDomains: { type: 'array', items: { type: 'string' } },
              status: { type: 'string', enum: ['enabled', 'disabled'] },
              metadataUrl: { type: 'string' },
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
  return listSamlProviders(ctx);
});
