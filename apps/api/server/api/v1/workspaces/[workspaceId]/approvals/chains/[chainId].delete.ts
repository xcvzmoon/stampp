import { defineHandler, defineRouteMeta } from 'nitro';
import { deleteApprovalChain } from '~/server/utils/approvalChains.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'Delete approval chain',
    description: 'Hard-deletes unused chains; deactivates chains with run history.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'chainId', required: true, schema: { type: 'string' } }],
    responses: {
      204: { description: 'Deleted or deactivated' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'approval:manage');
  const chainId = requireParam(event, 'chainId');
  await deleteApprovalChain(ctx, chainId, requestId);
  event.res.status = 204;
  return null;
});
