import { createAssignmentInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createAssignment } from '~/server/utils/scheduling.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scheduling'],
    summary: 'Create project assignment',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['userId', 'projectId', 'startDate', 'endDate', 'hoursPerWeek'],
            properties: {
              userId: { type: 'string' },
              projectId: { type: 'string' },
              startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              hoursPerWeek: { type: 'number', minimum: 0.5, maximum: 168 },
              note: { type: ['string', 'null'], maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created assignment',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AssignmentDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Invalid range, hours, or inactive project',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'schedule:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createAssignmentInputSchema, body, requestId);
  const row = await createAssignment(ctx, input, requestId);
  event.res.status = 201;
  return row;
});
