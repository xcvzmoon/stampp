import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listKioskDevices, parseKioskListQuery } from '~/server/utils/kiosk.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'List kiosk devices',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Kiosk devices',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/KioskDeviceList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          KioskDeviceDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'keyPrefix',
              'status',
              'lastUsedAt',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              keyPrefix: { type: 'string' },
              status: { type: 'string', enum: ['active', 'revoked'] },
              lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          KioskDeviceList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/KioskDeviceDto' } },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          KioskDeviceCreated: {
            type: 'object',
            required: ['device', 'deviceKey'],
            properties: {
              device: { $ref: '#/components/schemas/KioskDeviceDto' },
              deviceKey: { type: 'string' },
            },
          },
          KioskCredentialDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'hasPin',
              'hasQrToken',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              hasPin: { type: 'boolean' },
              hasQrToken: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          KioskCredentialList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/KioskCredentialDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          KioskPunchResult: {
            type: 'object',
            required: ['action', 'recordId', 'userId', 'clockInAt', 'clockOutAt', 'deviceId'],
            properties: {
              action: { type: 'string', enum: ['clock_in', 'clock_out'] },
              recordId: { type: 'string' },
              userId: { type: 'string' },
              clockInAt: { type: 'string', format: 'date-time' },
              clockOutAt: { type: ['string', 'null'], format: 'date-time' },
              deviceId: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'kiosk:manage');
  const query = parseKioskListQuery(event.url.searchParams, getRequestId(event));
  return listKioskDevices(ctx, query);
});
