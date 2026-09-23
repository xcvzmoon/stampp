import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { deleteCustomRole } from '~/server/utils/roles.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['roles'],
    summary: 'Delete custom role',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      204: { description: 'Deleted' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const roleId = requireParam(event, 'roleId');
  await deleteCustomRole(ctx, roleId, requestId);
  event.res.status = 204;
  return null;
});
