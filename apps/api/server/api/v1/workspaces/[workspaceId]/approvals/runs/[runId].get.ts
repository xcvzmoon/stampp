import { defineHandler, defineRouteMeta } from 'nitro';
import { getApprovalRun } from '~/server/utils/approvalChains.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'Get approval run',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'runId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Approval run',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApprovalRunDto' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'approval:read');
  const runId = requireParam(event, 'runId');
  return getApprovalRun(ctx, runId, getRequestId(event));
});
