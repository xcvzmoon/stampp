import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { removeTimeEntry } from '~/server/utils/timeTracking.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-entries'],
    summary: 'Delete time entry',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      204: { description: 'Time entry deleted' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
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
  await removeTimeEntry(ctx, entryId, requestId);
  event.res.status = 204;
  return null;
});
