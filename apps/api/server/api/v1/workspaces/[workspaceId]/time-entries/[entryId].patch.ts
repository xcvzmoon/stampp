import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { timeSchemas } from '~/server/utils/time.ts';
import { updateTimeEntry } from '~/server/utils/timeTracking.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-entries'],
    summary: 'Update time entry',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            minProperties: 1,
            properties: {
              projectId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
              description: { type: 'string', maxLength: 1000 },
              billable: { type: 'boolean' },
              tagIds: { type: 'array', maxItems: 20, items: { type: 'string' } },
              startAt: { type: 'string', format: 'date-time' },
              endAt: { type: ['string', 'null'], format: 'date-time' },
              durationMinutes: { type: ['integer', 'null'], minimum: 1 },
              workDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              timezone: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated time entry',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeEntryDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Overlaps an existing entry',
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
  const body = await readJsonBody(event, requestId);
  const input = parseBody(timeSchemas.updateEntry, body, requestId);
  return updateTimeEntry(ctx, entryId, input, requestId);
});
