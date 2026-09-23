import { updateApprovalChainInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { updateApprovalChain } from '~/server/utils/approvalChains.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'Update approval chain',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'chainId', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              active: { type: 'boolean' },
              steps: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: { type: 'object' },
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated chain',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApprovalChainDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
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
  const chainId = requireParam(event, 'chainId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateApprovalChainInputSchema, body, requestId);
  return updateApprovalChain(ctx, chainId, input, requestId);
});
