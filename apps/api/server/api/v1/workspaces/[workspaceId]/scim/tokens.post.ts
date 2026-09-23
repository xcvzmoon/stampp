import { scimTokenCreateInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createScimToken } from '~/server/utils/scim.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'Create SCIM token (returned once)',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      201: {
        description: 'Created SCIM token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'tokenDto'],
              properties: {
                token: { type: 'string' },
                tokenDto: { $ref: '#/components/schemas/ScimTokenDto' },
              },
            },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(scimTokenCreateInputSchema, body, requestId);
  const created = await createScimToken(ctx, input, requestId);
  event.res.status = 201;
  return created;
});
