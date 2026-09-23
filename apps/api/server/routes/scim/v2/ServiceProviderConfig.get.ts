import { scimError } from '@stampp/domain';
import { defineHandler, defineRouteMeta } from 'nitro';
import {
  scimJson,
  scimServiceProviderConfig,
  requireScimWorkspace,
} from '~/server/utils/scimService.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'SCIM 2.0 service provider configuration',
    security: [{ scimToken: [] }],
    responses: {
      200: {
        description: 'ServiceProviderConfig',
        content: { 'application/scim+json': { schema: { type: 'object' } } },
      },
      401: { description: 'Invalid SCIM token' },
    },
    $global: {
      components: {
        securitySchemes: {
          scimToken: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'scim_',
            description: 'Workspace SCIM token minted in settings.',
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  await requireScimWorkspace(event);
  return scimJson(200, scimServiceProviderConfig());
});

void scimError;
