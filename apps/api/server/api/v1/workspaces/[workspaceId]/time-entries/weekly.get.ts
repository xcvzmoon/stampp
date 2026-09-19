import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { parseWeeklyTimeQuery } from '~/server/utils/time.ts';
import { getWeeklyTimeSummary } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-entries'],
    summary: 'Weekly timesheet summary',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'weekStart',
        required: true,
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        description: 'Monday calendar date',
      },
      {
        in: 'query',
        name: 'timezone',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: {
        description: 'Weekly summary for the caller',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: [
                'weekStart',
                'weekEnd',
                'timezone',
                'days',
                'projects',
                'totalMinutes',
                'expectedMinutes',
                'missingMinutes',
              ],
              properties: {
                weekStart: { type: 'string' },
                weekEnd: { type: 'string' },
                timezone: { type: 'string' },
                days: { type: 'array', items: { type: 'object' } },
                projects: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      projectId: { type: ['string', 'null'] },
                      entries: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TimeEntryDto' },
                      },
                      dailyMinutes: { type: 'array', items: { type: 'integer' } },
                      totalMinutes: { type: 'integer' },
                    },
                  },
                },
                totalMinutes: { type: 'integer' },
                expectedMinutes: { type: 'integer' },
                missingMinutes: { type: 'integer' },
              },
            },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:read:own');
  const query = parseWeeklyTimeQuery(event.url.searchParams, requestId);
  return getWeeklyTimeSummary(ctx, query);
});
