import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { downloadExpenseReceipt } from '~/server/utils/expenses.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['expenses'],
    summary: 'Download expense receipt',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'expenseId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Receipt binary',
        content: {
          'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      503: {
        description: 'Object storage is not configured',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'expense:read:own');
  const expenseId = requireParam(event, 'expenseId');
  const receipt = await downloadExpenseReceipt(ctx, expenseId, requestId);
  event.res.headers.set('content-type', receipt.contentType);
  event.res.headers.set(
    'content-disposition',
    `attachment; filename="${receipt.filename.replace(/"/g, '')}"`,
  );
  return receipt.bytes;
});
