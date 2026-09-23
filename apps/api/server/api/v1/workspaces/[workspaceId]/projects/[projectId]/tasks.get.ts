import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listProjectTasks } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tasks'],
    summary: 'List project tasks',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'search', schema: { type: 'string', maxLength: 200 } },
    ],
    responses: {
      200: {
        description: 'Tasks for the project',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TaskList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const projectId = requireParam(event, 'projectId');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listProjectTasks(
    ctx,
    projectId,
    {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
    },
    requestId,
  );
});
