import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { duplicateTimeEntry } from '~/server/utils/timeTracking.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-entries'],
    summary: 'Duplicate time entry',
    description:
      'Copies project, task, description, billable flag, tags, duration, work date, and timezone from a completed unlocked entry. Interval sources are stored as duration copies.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Duplicated time entry',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeEntryDto' },
          },
        },
      },
      400: {
        description: 'Source entry has no duration',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Source entry is a running timer',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      423: {
        description: 'Time entry is locked',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const entryId = requireParam(event, 'entryId');
  return duplicateTimeEntry(ctx, entryId, requestId);
});
