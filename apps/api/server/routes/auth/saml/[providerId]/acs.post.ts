import { ERROR_CODES } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { loadSamlProviderById } from '~/server/utils/saml.ts';
import { completeSamlSignIn, createSamlClient } from '~/server/utils/samlAuth.ts';
import { requireParam } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['saml'],
    summary: 'SAML assertion consumer service',
    security: [],
    requestBody: {
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: {
            type: 'object',
            properties: {
              SAMLResponse: { type: 'string' },
              RelayState: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      302: { description: 'Redirect into the workspace after sign-in' },
      403: {
        description: 'Invalid assertion or blocked email domain',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
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

  const form = await event.req.formData();
  const samlResponseResult = v.safeParse(
    v.pipe(v.string(), v.minLength(1)),
    form.get('SAMLResponse'),
  );
  if (!samlResponseResult.success) {
    throw toApiError(ERROR_CODES.SAML_ASSERTION_INVALID, 'Missing SAMLResponse', requestId);
  }
  const samlResponse = samlResponseResult.output;

  const saml = createSamlClient(provider);
  try {
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    if (!result.profile) {
      throw toApiError(ERROR_CODES.SAML_ASSERTION_INVALID, 'SAML assertion rejected', requestId);
    }
    const signedIn = await completeSamlSignIn(provider, result.profile);
    return new Response(null, {
      status: 302,
      headers: {
        location: signedIn.redirectTo,
        'set-cookie': signedIn.setCookie,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'sso.email_domain_blocked') {
      throw toApiError(ERROR_CODES.SSO_EMAIL_DOMAIN_BLOCKED, 'Email domain not allowed', requestId);
    }
    if (error instanceof Error && error.message === 'saml.assertion_invalid') {
      throw toApiError(ERROR_CODES.SAML_ASSERTION_INVALID, 'SAML assertion rejected', requestId);
    }
    throw toApiError(ERROR_CODES.SAML_ASSERTION_INVALID, 'SAML assertion rejected', requestId);
  }
});
