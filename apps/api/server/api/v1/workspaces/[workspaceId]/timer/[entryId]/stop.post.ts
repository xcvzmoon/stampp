import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { stopTimer } from '~/server/utils/timeTracking.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timer'],
    summary: 'Stop timer',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Stopped timer',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeEntryDto' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Entry is not a running timer',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      423: {
        description: 'Time entry is locked',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const entryId = requireParam(event, 'entryId');
  return stopTimer(ctx, entryId, requestId);
});
