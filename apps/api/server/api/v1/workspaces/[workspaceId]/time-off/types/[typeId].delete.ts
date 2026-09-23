import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { deleteTimeOffType } from '~/server/utils/timeOff.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Delete time-off type',
    description: 'Hard-deletes unused types; deactivates types with request history.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'typeId', required: true, schema: { type: 'string' } }],
    responses: {
      204: { description: 'Deleted or deactivated' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:manage');
  const typeId = requireParam(event, 'typeId');
  await deleteTimeOffType(ctx, typeId, requestId);
  event.res.status = 204;
  return null;
});
