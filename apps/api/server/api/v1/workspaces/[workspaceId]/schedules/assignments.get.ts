import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listAssignments, parseScheduleListQuery } from '~/server/utils/scheduling.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scheduling'],
    summary: 'List project assignments',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'from', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      { in: 'query', name: 'to', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      { in: 'query', name: 'active', schema: { type: 'boolean' } },
    ],
    responses: {
      200: {
        description: 'Project assignments',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AssignmentList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'schedule:read:own');
  const query = parseScheduleListQuery(event.url.searchParams, requestId);
  return listAssignments(ctx, query);
});
