import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { archiveProject } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'Archive project',
    security: [{ sessionCookie: [] }],
    responses: {
      204: { description: 'Project archived' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const projectId = requireParam(event, 'projectId');
  await archiveProject(ctx, projectId, requestId);
  event.res.status = 204;
  return null;
});
