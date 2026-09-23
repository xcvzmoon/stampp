import { setKioskPinInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { setKioskPin } from '~/server/utils/kiosk.ts';
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
    summary: 'Set member kiosk PIN',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['pin'],
            properties: {
              userId: { type: 'string' },
              pin: { type: 'string', pattern: '^\\d{4,8}$' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Saved credential',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/KioskCredentialDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'attendance:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(setKioskPinInputSchema, body, requestId);
  return setKioskPin(ctx, input, requestId);
});
