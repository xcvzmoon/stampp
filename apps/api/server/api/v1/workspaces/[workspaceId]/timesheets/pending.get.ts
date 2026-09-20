import { defineHandler, defineRouteMeta } from 'nitro';
import { listPendingTimesheets } from '~/server/utils/timesheets.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timesheets'],
    summary: 'List submitted timesheets awaiting approval',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
    ],
    responses: {
      200: {
        description: 'Pending approvals',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimesheetList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'time:approve');
  const rawLimit = event.url.searchParams.get('limit');
  const parsed = rawLimit ? Number(rawLimit) : 50;
  const limit = Number.isInteger(parsed) && parsed >= 1 && parsed <= 200 ? parsed : 50;
  return listPendingTimesheets(ctx, limit);
});
