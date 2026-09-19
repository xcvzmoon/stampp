import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listProjects } from '~/server/utils/catalogService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'List projects',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'status',
        schema: { type: 'string', enum: ['active', 'archived'] },
      },
      { in: 'query', name: 'clientId', schema: { type: 'string' } },
      { in: 'query', name: 'search', schema: { type: 'string', maxLength: 200 } },
    ],
    responses: {
      200: {
        description: 'Workspace projects',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProjectList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listProjects(ctx, {
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
    status: query.status,
    clientId: query.clientId,
  });
});
