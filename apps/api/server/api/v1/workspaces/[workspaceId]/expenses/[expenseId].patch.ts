import { updateExpenseInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateExpense } from '~/server/utils/expenses.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['expenses'],
    summary: 'Update expense',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'expenseId', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      200: {
        description: 'Updated expense',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ExpenseDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
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
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateExpenseInputSchema, body, requestId);
  return updateExpense(ctx, expenseId, input, requestId);
});
