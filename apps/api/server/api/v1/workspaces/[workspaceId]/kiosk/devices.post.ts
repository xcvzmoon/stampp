import { createKioskDeviceInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createKioskDevice } from '~/server/utils/kiosk.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'Register kiosk device',
    description:
      'Returns the device key once. Store it on the device; it cannot be retrieved again.',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 80 },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created device with one-time key',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/KioskDeviceCreated' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'kiosk:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createKioskDeviceInputSchema, body, requestId);
  const result = await createKioskDevice(ctx, input, requestId);
  event.res.status = 201;
  return result;
});
