import { createExpenseInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createExpense } from '~/server/utils/expenses.ts';
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
    tags: ['expenses'],
    summary: 'Create expense',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['expenseDate', 'amountMinor', 'currency', 'category', 'description'],
            properties: {
              projectId: { type: ['string', 'null'] },
              expenseDate: { type: 'string' },
              amountMinor: { type: 'integer', minimum: 1 },
              currency: { type: 'string', minLength: 3, maxLength: 3 },
              category: { type: 'string' },
              description: { type: 'string' },
              notes: { type: 'string' },
              billable: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created expense',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ExpenseDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'expense:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createExpenseInputSchema, body, requestId);
  const expense = await createExpense(ctx, input, requestId);
  event.res.status = 201;
  return expense;
});
