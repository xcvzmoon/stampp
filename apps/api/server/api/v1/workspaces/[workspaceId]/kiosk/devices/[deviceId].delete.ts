import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { revokeKioskDevice } from '~/server/utils/kiosk.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'Revoke kiosk device',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'deviceId', required: true, schema: { type: 'string' } }],
    responses: {
      204: { description: 'Revoked' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'kiosk:manage');
  const deviceId = requireParam(event, 'deviceId');
  await revokeKioskDevice(ctx, deviceId, requestId);
  event.res.status = 204;
  return null;
});
