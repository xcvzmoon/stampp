import type { JsonValue } from '@stampp/shared';
import { applyWorkspaceRlsContext } from '@stampp/database';
import { ERROR_CODES, kioskPunchInputSchema } from '@stampp/shared';
import { useLogger } from 'evlog/nitro/v3';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId, readJsonBody } from '~/server/utils/catalog.ts';
import { getDb } from '~/server/utils/db.ts';
import { findKioskDeviceByKey, kioskPunch } from '~/server/utils/kiosk.ts';

/**
 * Shared-device attendance punch. Auth is device key (header) + member PIN/QR.
 * No session cookie. Clocks attendance only.
 */
defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'Kiosk attendance punch',
    description:
      'Authenticates with a registered device key and member PIN or QR token, then toggles attendance clock-in/out.',
    security: [{ kioskDeviceKey: [] }],
    parameters: [
      { in: 'path', name: 'workspaceId', required: true, schema: { type: 'string' } },
      {
        in: 'header',
        name: 'x-kiosk-device-key',
        required: true,
        schema: { type: 'string', minLength: 32 },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['method', 'timezone'],
            properties: {
              method: { type: 'string', enum: ['pin', 'qr'] },
              pin: { type: 'string', pattern: '^\\d{4,8}$' },
              qrToken: { type: 'string' },
              timezone: { type: 'string' },
              note: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Punch result',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/KioskPunchResult' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: {
        description: 'Invalid device key or member credential',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      403: {
        description: 'Device revoked',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Already clocked in or not clocked in',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const workspaceId = event.context.params?.workspaceId;
  if (!workspaceId) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'workspaceId is required', requestId);
  }
  const deviceKey = event.req.headers.get('x-kiosk-device-key')?.trim();
  if (!deviceKey) {
    throw toApiError(ERROR_CODES.UNAUTHENTICATED, 'Missing kiosk device key', requestId);
  }

  const db = getDb();
  const device = await findKioskDeviceByKey(db, workspaceId, deviceKey, requestId);
  await applyWorkspaceRlsContext(db, device.workspaceId);

  const contentLength = event.req.headers.get('content-length');
  let body: JsonValue = {};
  if (contentLength && contentLength !== '0') {
    body = await readJsonBody(event, requestId);
  }
  const input = v.safeParse(kioskPunchInputSchema, body);
  if (!input.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Punch payload failed validation',
      requestId,
      input.issues,
    );
  }

  const ctx = {
    userId: 'kiosk-device',
    workspaceId: device.workspaceId,
    role: 'member' as const,
    db: { workspaceId: device.workspaceId, client: db },
  };
  const result = await kioskPunch(ctx, device, input.output, requestId);
  useLogger(event).set({
    action: 'attendance.kiosk_punch',
    kiosk: { deviceId: device.id, punchAction: result.action, recordId: result.recordId },
  });
  return result;
});
