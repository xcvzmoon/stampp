import { ERROR_CODES } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { loadSamlProviderById } from '~/server/utils/saml.ts';
import { buildServiceProviderMetadata, createSamlClient } from '~/server/utils/samlAuth.ts';
import { requireParam } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['saml'],
    summary: 'SAML service-provider metadata',
    security: [],
    responses: {
      200: {
        description: 'SP metadata XML',
        content: { 'application/xml': { schema: { type: 'string' } } },
      },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const providerId = requireParam(event, 'providerId');
  const provider = await loadSamlProviderById(providerId);
  if (!provider) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'SAML provider not found', requestId);
  }
  createSamlClient(provider);
  const metadata = buildServiceProviderMetadata(provider);
  event.res.headers.set('content-type', 'application/xml');
  return metadata;
});
