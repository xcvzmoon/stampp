import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listTags } from '~/server/utils/catalogService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tags'],
    summary: 'List tags',
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
        description: 'Workspace tags',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TagList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'tag:read');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listTags(ctx, {
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
  });
});
