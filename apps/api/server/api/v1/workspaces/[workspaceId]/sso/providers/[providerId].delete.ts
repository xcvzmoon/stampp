import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { deleteSsoProvider } from '~/server/utils/sso.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['sso'],
    summary: 'Delete workspace OIDC provider',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      204: { description: 'Deleted' },
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
  const providerId = requireParam(event, 'providerId');
  await deleteSsoProvider(ctx, providerId, requestId);
  event.res.status = 204;
  return null;
});
