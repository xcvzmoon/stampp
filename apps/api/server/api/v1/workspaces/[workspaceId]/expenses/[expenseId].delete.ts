import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { archiveExpense } from '~/server/utils/expenses.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['expenses'],
    summary: 'Delete expense',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'expenseId', required: true, schema: { type: 'string' } }],
    responses: {
      204: { description: 'Deleted' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'expense:write:own');
  const expenseId = requireParam(event, 'expenseId');
  await archiveExpense(ctx, expenseId, requestId);
  event.res.status = 204;
  return null;
});
