import { ERROR_CODES } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { loadSamlProviderById } from '~/server/utils/saml.ts';
import { createSamlClient } from '~/server/utils/samlAuth.ts';
import { requireParam } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['saml'],
    summary: 'Start SAML SP-initiated login',
    security: [],
    responses: {
      302: { description: 'Redirect to IdP SSO URL' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const providerId = requireParam(event, 'providerId');
  const provider = await loadSamlProviderById(providerId);
  if (provider?.status !== 'enabled') {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'SAML provider not found', requestId);
  }
  const saml = createSamlClient(provider);
  const relayState = event.url.searchParams.get('RelayState') ?? '/w';
  const authorizeUrl = await saml.getAuthorizeUrlAsync(relayState, event.url.host, {});
  return new Response(null, {
    status: 302,
    headers: { location: authorizeUrl },
  });
});
