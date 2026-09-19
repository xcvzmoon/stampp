import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { timeSchemas } from '~/server/utils/time.ts';
import { addManualTime } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-entries'],
    summary: 'Create manual time entry',
    description:
      'Body must be an interval (startAt/endAt) or a duration (durationMinutes), selected by kind.',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            oneOf: [
              {
                type: 'object',
                required: ['kind', 'startAt', 'endAt', 'timezone'],
                properties: {
                  kind: { type: 'string', enum: ['interval'] },
                  projectId: { type: ['string', 'null'] },
                  taskId: { type: ['string', 'null'] },
                  description: { type: 'string', maxLength: 1000 },
                  billable: { type: 'boolean' },
                  tagIds: { type: 'array', maxItems: 20, items: { type: 'string' } },
                  startAt: { type: 'string', format: 'date-time' },
                  endAt: { type: 'string', format: 'date-time' },
                  timezone: { type: 'string' },
                },
              },
              {
                type: 'object',
                required: ['kind', 'durationMinutes', 'timezone'],
                properties: {
                  kind: { type: 'string', enum: ['duration'] },
                  projectId: { type: ['string', 'null'] },
                  taskId: { type: ['string', 'null'] },
                  description: { type: 'string', maxLength: 1000 },
                  billable: { type: 'boolean' },
                  tagIds: { type: 'array', maxItems: 20, items: { type: 'string' } },
                  durationMinutes: { type: 'integer', minimum: 1 },
                  workDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                  timezone: { type: 'string' },
                },
              },
            ],
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Created time entry',
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
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(timeSchemas.addManual, body, requestId);
  return addManualTime(ctx, input, requestId);
});
