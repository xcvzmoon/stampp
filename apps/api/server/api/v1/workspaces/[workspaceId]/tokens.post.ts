import { createPersonalAccessTokenInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createPersonalAccessToken } from '~/server/utils/personalAccessTokenService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
    ],
    tags: ['tokens'],
    summary: 'Create personal access token (token returned once)',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      201: {
        description: 'Created token with plaintext value',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'tokenDto'],
              properties: {
                token: { type: 'string' },
                tokenDto: { $ref: '#/components/schemas/PersonalAccessTokenDto' },
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
  const ctx = await requireWorkspace(event, 'project:read');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createPersonalAccessTokenInputSchema, body, requestId);
  const created = await createPersonalAccessToken(ctx, input, requestId);
  event.res.status = 201;
  return created;
});
