import { updateAssignmentInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateAssignment } from '~/server/utils/scheduling.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scheduling'],
    summary: 'Update project assignment',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
      { in: 'path', name: 'assignmentId', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              hoursPerWeek: { type: 'number', minimum: 0.5, maximum: 168 },
              note: { type: ['string', 'null'], maxLength: 500 },
              active: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated assignment',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AssignmentDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Invalid range or hours',
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
  const assignmentId = requireParam(event, 'assignmentId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateAssignmentInputSchema, body, requestId);
  return updateAssignment(ctx, assignmentId, input, requestId);
});
