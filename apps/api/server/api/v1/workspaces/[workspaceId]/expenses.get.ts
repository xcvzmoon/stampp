import { DEFAULT_LIST_LIMIT, ERROR_CODES, expenseListQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listExpenses } from '~/server/utils/expenses.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseExpenseListQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of [
    'limit',
    'cursor',
    'projectId',
    'userId',
    'category',
    'status',
    'from',
    'to',
  ]) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(expenseListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return { ...result.output, limit: result.output.limit ?? DEFAULT_LIST_LIMIT };
}

defineRouteMeta({
  openAPI: {
    tags: ['expenses'],
    summary: 'List expenses',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      { in: 'query', name: 'category', schema: { type: 'string' } },
      { in: 'query', name: 'status', schema: { type: 'string' } },
      { in: 'query', name: 'from', schema: { type: 'string' } },
      { in: 'query', name: 'to', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Expenses',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ExpenseList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          ExpenseDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'projectId',
              'expenseDate',
              'amountMinor',
              'currency',
              'category',
              'description',
              'notes',
              'billable',
              'status',
              'receiptFilename',
              'receiptContentType',
              'receiptSizeBytes',
              'hasReceipt',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              projectId: { type: ['string', 'null'] },
              expenseDate: { type: 'string' },
              amountMinor: { type: 'integer', minimum: 1 },
              currency: { type: 'string', minLength: 3, maxLength: 3 },
              category: {
                type: 'string',
                enum: ['travel', 'meals', 'lodging', 'software', 'equipment', 'other'],
              },
              description: { type: 'string' },
              notes: { type: ['string', 'null'] },
              billable: { type: 'boolean' },
              status: { type: 'string', enum: ['open', 'approved', 'rejected'] },
              receiptFilename: { type: ['string', 'null'] },
              receiptContentType: { type: ['string', 'null'] },
              receiptSizeBytes: { type: ['integer', 'null'] },
              hasReceipt: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          ExpenseList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ExpenseDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'expense:read:own');
  const query = parseExpenseListQuery(event.url.searchParams, requestId);
  return listExpenses(ctx, query);
});
