import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listTimeOffRequests, parseTimeOffListQuery } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'List time-off requests',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'status',
        schema: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'canceled'],
        },
      },
      { in: 'query', name: 'typeId', schema: { type: 'string' } },
      { in: 'query', name: 'from', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      { in: 'query', name: 'to', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
    ],
    responses: {
      200: {
        description: 'Time-off requests',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffRequestList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:read:own');
  const query = parseTimeOffListQuery(event.url.searchParams, requestId);
  return listTimeOffRequests(ctx, query);
});
