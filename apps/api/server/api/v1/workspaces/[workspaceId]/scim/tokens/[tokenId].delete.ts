import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { revokeScimToken } from '~/server/utils/scim.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'Revoke SCIM token',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      204: { description: 'Revoked' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const tokenId = requireParam(event, 'tokenId');
  await revokeScimToken(ctx, tokenId, requestId);
  event.res.status = 204;
  return null;
});
