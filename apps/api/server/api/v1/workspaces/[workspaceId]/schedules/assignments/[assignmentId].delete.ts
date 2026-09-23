import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { deleteAssignment } from '~/server/utils/scheduling.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scheduling'],
    summary: 'Delete project assignment',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } }],
    responses: {
      204: { description: 'Deleted' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'schedule:manage');
  const assignmentId = requireParam(event, 'assignmentId');
  await deleteAssignment(ctx, assignmentId, requestId);
  event.res.status = 204;
  return null;
});
