import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { revokePersonalAccessToken } from '~/server/utils/personalAccessTokenService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tokens'],
    summary: 'Revoke personal access token',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'tokenId', required: true, schema: { type: 'string' } }],
    responses: {
      204: { description: 'Revoked' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const tokenId = requireParam(event, 'tokenId');
  await revokePersonalAccessToken(ctx, tokenId, requestId);
  event.res.status = 204;
  return null;
});
