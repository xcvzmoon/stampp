import { defineHandler, defineRouteMeta } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createTask } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tasks'],
    summary: 'Create project task',
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
              estimateMinutes: { type: ['integer', 'null'], minimum: 0 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created task',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TaskDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
      422: {
        description: 'Project is archived',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const projectId = requireParam(event, 'projectId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.createTask, body, requestId);
  const task = await createTask(ctx, projectId, input, requestId);
  event.res.status = 201;
  return task;
});
