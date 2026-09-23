import { decideTimeOffInputSchema, type JsonValue } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { rejectTimeOffRequest } from '~/server/utils/timeOff.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'Reject time-off request',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
      { in: 'path', name: 'requestId', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { note: { type: 'string', maxLength: 2000 } },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Rejected request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffRequestDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Invalid time-off transition or range',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:approve');
  const targetId = requireParam(event, 'requestId');
  const contentLength = event.req.headers.get('content-length');
  let body: JsonValue = {};
  if (contentLength && contentLength !== '0') {
    body = await readJsonBody(event, requestId);
  }
  const input = parseBody(decideTimeOffInputSchema, body, requestId);
  return rejectTimeOffRequest(ctx, targetId, input, requestId);
});
