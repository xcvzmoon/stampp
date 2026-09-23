import { defineHandler, defineRouteMeta } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateProject } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

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
    tags: ['projects'],
    summary: 'Update project',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            minProperties: 1,
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              clientId: { type: ['string', 'null'] },
              code: { type: ['string', 'null'], maxLength: 64 },
              color: { type: ['string', 'null'], pattern: '^#[0-9A-Fa-f]{6}$' },
              status: { type: 'string', enum: ['active', 'archived'] },
              billable: { type: 'boolean' },
              notes: { type: ['string', 'null'], maxLength: 5000 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated project',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProjectDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const projectId = requireParam(event, 'projectId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateProject, body, requestId);
  return updateProject(ctx, projectId, input, requestId);
});
