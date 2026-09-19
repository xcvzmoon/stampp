import { defineHandler, defineRouteMeta } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createClient } from '~/server/utils/catalogService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['clients'],
    summary: 'Create client',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              email: { type: 'string', format: 'email' },
              address: { type: 'string', maxLength: 2000 },
              notes: { type: 'string', maxLength: 5000 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created client',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ClientDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'client:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.createClient, body, requestId);
  const client = await createClient(ctx, input, requestId);
  event.res.status = 201;
  return client;
});
