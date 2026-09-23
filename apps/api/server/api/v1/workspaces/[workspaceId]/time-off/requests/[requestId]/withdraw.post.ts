import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { withdrawTimeOffRequest } from '~/server/utils/timeOff.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Withdraw pending time-off request',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'requestId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Withdrawn request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffRequestDto' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Invalid time-off transition or range',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:write:own');
  const targetId = requireParam(event, 'requestId');
  return withdrawTimeOffRequest(ctx, targetId, requestId);
});
