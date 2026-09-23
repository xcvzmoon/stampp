import { decideApprovalInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { decideApprovalRunFromHandler } from '~/server/utils/approvalChains.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'Decide approval run step',
    description:
      'Approves or rejects the current multi-stage step. Final approve/reject is applied to the linked entity by the caller service.',
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
      { in: 'path', name: 'runId', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['action'],
            properties: {
              action: { type: 'string', enum: ['approve', 'reject'] },
              note: { type: 'string', maxLength: 2000 },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated approval run',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApprovalRunDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      409: {
        description: 'Run already decided',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
      422: {
        description: 'Invalid approval step',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'approval:read');
  const runId = requireParam(event, 'runId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(decideApprovalInputSchema, body, requestId);
  return decideApprovalRunFromHandler(ctx, runId, input, requestId);
});
