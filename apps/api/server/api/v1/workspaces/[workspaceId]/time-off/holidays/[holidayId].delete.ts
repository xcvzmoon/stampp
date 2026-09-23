import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { deleteHoliday } from '~/server/utils/timeOff.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Delete holiday',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'holidayId', required: true, schema: { type: 'string' } }],
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
  const ctx = await requireWorkspace(event, 'timeoff:manage');
  const holidayId = requireParam(event, 'holidayId');
  await deleteHoliday(ctx, holidayId, requestId);
  event.res.status = 204;
  return null;
});
