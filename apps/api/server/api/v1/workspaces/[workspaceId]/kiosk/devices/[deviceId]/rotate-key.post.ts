import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { rotateKioskDeviceKey } from '~/server/utils/kiosk.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'Rotate kiosk device key',
    description: 'Issues a new device key and returns it once. The previous key stops working.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'deviceId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Rotated key',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/KioskDeviceCreated' },
          },
        },
      },
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
  return rotateKioskDeviceKey(ctx, deviceId, requestId);
});
