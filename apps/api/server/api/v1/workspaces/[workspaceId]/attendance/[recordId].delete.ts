import { defineHandler, defineRouteMeta } from 'nitro';
import { deleteAttendance } from '~/server/utils/attendance.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['attendance'],
    summary: 'Delete attendance record',
    description: 'Removes a manual or open attendance punch (manager only).',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'recordId', required: true, schema: { type: 'string' } }],
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
  const ctx = await requireWorkspace(event, 'attendance:manage');
  const recordId = requireParam(event, 'recordId');
  await deleteAttendance(ctx, recordId, requestId);
  event.res.status = 204;
  return null;
});
