import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listKioskCredentials, parseKioskListQuery } from '~/server/utils/kiosk.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'List member kiosk credentials',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Member credentials',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/KioskCredentialList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'kiosk:manage');
  const query = parseKioskListQuery(event.url.searchParams, getRequestId(event));
  return listKioskCredentials(ctx, query);
});
