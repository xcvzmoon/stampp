import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { parseTimeEntryListQuery } from '~/server/utils/time.ts';
import { listTimeEntries } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-entries'],
    summary: 'List time entries',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
      { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Caller time entries',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeEntryList' },
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
  const ctx = await requireWorkspace(event, 'time:read:own');
  const query = parseTimeEntryListQuery(event.url.searchParams, requestId);
  return listTimeEntries(ctx, query);
});
