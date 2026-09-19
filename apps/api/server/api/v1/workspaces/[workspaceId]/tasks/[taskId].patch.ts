import { defineHandler, defineRouteMeta } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateTask } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tasks'],
    summary: 'Update task',
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
              status: { type: 'string', enum: ['active', 'archived'] },
              estimateMinutes: { type: ['integer', 'null'], minimum: 0 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated task',
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
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const taskId = requireParam(event, 'taskId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateTask, body, requestId);
  return updateTask(ctx, taskId, input, requestId);
});
