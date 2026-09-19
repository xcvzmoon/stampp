import { defineHandler, defineRouteMeta } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateClient } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['clients'],
    summary: 'Update client',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            minProperties: 1,
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              email: { type: ['string', 'null'], format: 'email' },
              address: { type: ['string', 'null'], maxLength: 2000 },
              notes: { type: ['string', 'null'], maxLength: 5000 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated client',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ClientDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'client:manage');
  const clientId = requireParam(event, 'clientId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateClient, body, requestId);
  return updateClient(ctx, clientId, input, requestId);
});
