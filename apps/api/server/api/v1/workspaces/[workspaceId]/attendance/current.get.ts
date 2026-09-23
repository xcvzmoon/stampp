import { defineHandler, defineRouteMeta } from 'nitro';
import { getCurrentAttendance } from '~/server/utils/attendance.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['attendance'],
    summary: 'Get current attendance punch',
    description: "Returns the caller's open attendance record, or null when clocked out.",
    security: [{ sessionCookie: [] }],
    responses: {
      200: {
        description: 'Current attendance state',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CurrentAttendance' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'attendance:read:own');
  return getCurrentAttendance(ctx);
});
