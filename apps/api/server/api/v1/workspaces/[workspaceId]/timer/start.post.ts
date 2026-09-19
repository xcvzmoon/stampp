import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { timeSchemas } from '~/server/utils/time.ts';
import { startTimer } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['timer'],
    summary: 'Start timer',
    description: "Starts the caller's running timer. One running timer per user per workspace.",
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['timezone'],
            properties: {
              projectId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
              description: { type: 'string', maxLength: 1000 },
              billable: { type: 'boolean' },
              tagIds: {
                type: 'array',
                maxItems: 20,
                items: { type: 'string' },
              },
              timezone: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Started timer',
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
        description: 'A timer is already running',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      422: {
        description: 'Project or task is not active',
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
  const input = parseBody(timeSchemas.startTimer, body, requestId);
  return startTimer(ctx, input, requestId);
});
