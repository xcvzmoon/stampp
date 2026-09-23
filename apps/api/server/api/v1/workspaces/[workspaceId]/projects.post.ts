import { defineHandler, defineRouteMeta } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createProject } from '~/server/utils/catalogService.ts';
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
    tags: ['projects'],
    summary: 'Create project',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              clientId: { type: ['string', 'null'] },
              code: { type: ['string', 'null'], maxLength: 64 },
              color: { type: ['string', 'null'], pattern: '^#[0-9A-Fa-f]{6}$' },
              billable: { type: 'boolean', default: true },
              notes: { type: 'string', maxLength: 5000 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created project',
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
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.createProject, body, requestId);
  const project = await createProject(ctx, input, requestId);
  event.res.status = 201;
  return project;
});
