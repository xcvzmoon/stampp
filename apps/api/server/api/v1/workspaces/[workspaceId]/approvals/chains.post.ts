import { createApprovalChainInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { createApprovalChain } from '~/server/utils/approvalChains.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'Create approval chain',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'entityType', 'steps'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 80 },
              entityType: { type: 'string', enum: ['timesheet', 'time_off_request'] },
              active: { type: 'boolean' },
              steps: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: {
                  type: 'object',
                  properties: { approverUserId: { type: ['string', 'null'] } },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created chain',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApprovalChainDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      409: { $ref: '#/components/responses/Conflict' },
      422: {
        description: 'Invalid chain configuration',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'approval:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createApprovalChainInputSchema, body, requestId);
  const chain = await createApprovalChain(ctx, input, requestId);
  event.res.status = 201;
  return chain;
});
