import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { archiveTag } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['tags'],
    summary: 'Archive tag',
    security: [{ sessionCookie: [] }],
    responses: {
      204: { description: 'Tag archived' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'tag:manage');
  const tagId = requireParam(event, 'tagId');
  await archiveTag(ctx, tagId, requestId);
  event.res.status = 204;
  return null;
});
