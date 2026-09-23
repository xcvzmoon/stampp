import type { JsonValue } from '@stampp/shared';
import { clearKioskPinInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { clearKioskPin } from '~/server/utils/kiosk.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['kiosk'],
    summary: 'Clear member kiosk PIN',
    security: [{ sessionCookie: [] }],
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
      204: { description: 'Cleared' },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
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
  const input = parseBody(clearKioskPinInputSchema, body, requestId);
  await clearKioskPin(ctx, input.userId, requestId);
  event.res.status = 204;
  return null;
});
