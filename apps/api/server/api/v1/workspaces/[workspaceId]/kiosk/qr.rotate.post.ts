import type { JsonValue } from '@stampp/shared';
import { rotateKioskQrInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { rotateKioskQrToken } from '~/server/utils/kiosk.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
    ],
    tags: ['kiosk'],
    summary: 'Rotate member kiosk QR token',
    description: 'Returns the QR token once for printing or embedding in a member QR code.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { userId: { type: 'string' } },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Rotated QR token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['credential', 'qrToken'],
              properties: {
                credential: { $ref: '#/components/schemas/KioskCredentialDto' },
                qrToken: { type: 'string' },
              },
            },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'attendance:write:own');
  const contentLength = event.req.headers.get('content-length');
  let body: JsonValue = {};
  if (contentLength && contentLength !== '0') {
    body = await readJsonBody(event, requestId);
  }
  const input = parseBody(rotateKioskQrInputSchema, body, requestId);
  return rotateKioskQrToken(ctx, input.userId, requestId);
});
