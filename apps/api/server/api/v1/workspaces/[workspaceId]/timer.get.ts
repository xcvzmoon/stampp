import { defineHandler, defineRouteMeta } from 'nitro';
import { getRunningTimer } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timer'],
    summary: 'Get running timer',
    security: [{ sessionCookie: [] }],
    responses: {
      200: {
        description: 'Running timer or null',
        content: {
          'application/json': {
            schema: {
              oneOf: [{ $ref: '#/components/schemas/TimeEntryDto' }, { type: 'null' }],
            },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'time:read:own');
  return getRunningTimer(ctx);
});
