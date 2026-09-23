import { createSsoProviderInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createSsoProvider } from '~/server/utils/sso.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
      },
    ],
    tags: ['sso'],
    summary: 'Create workspace OIDC provider (client secret never returned later)',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      201: {
        description: 'Created OIDC provider',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SsoProviderDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createSsoProviderInputSchema, body, requestId);
  const created = await createSsoProvider(ctx, input, requestId);
  event.res.status = 201;
  return created;
});
