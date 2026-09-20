import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { revokeRate } from '~/server/utils/rates.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['rates'],
    summary: 'Revoke open rate version',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'path',
        name: 'rateId',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: {
        description: 'Closed rate version',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RateDto' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Rate version is not revocable',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const rateId = requireParam(event, 'rateId');
  return revokeRate(ctx, rateId, requestId);
});
