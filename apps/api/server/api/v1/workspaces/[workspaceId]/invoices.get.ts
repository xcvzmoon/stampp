import { DEFAULT_LIST_LIMIT, ERROR_CODES, invoiceListQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listInvoices } from '~/server/utils/invoices.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseInvoiceListQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'status', 'clientId', 'projectId']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(invoiceListQuerySchema, raw);
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
    tags: ['invoices'],
    summary: 'List invoices',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'status', schema: { type: 'string' } },
      { in: 'query', name: 'clientId', schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Invoices',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/InvoiceList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          InvoiceDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'clientId',
              'projectId',
              'number',
              'status',
              'issueDate',
              'dueDate',
              'currency',
              'subtotalMinor',
              'discountMinor',
              'taxRateBps',
              'taxMinor',
              'totalMinor',
              'paidMinor',
              'balanceMinor',
              'notes',
              'lines',
              'payments',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              clientId: { type: ['string', 'null'] },
              projectId: { type: ['string', 'null'] },
              number: { type: 'string' },
              status: { type: 'string', enum: ['draft', 'sent', 'paid', 'void'] },
              issueDate: { type: 'string' },
              dueDate: { type: ['string', 'null'] },
              currency: { type: 'string' },
              subtotalMinor: { type: 'integer' },
              discountMinor: { type: 'integer' },
              taxRateBps: { type: 'integer' },
              taxMinor: { type: 'integer' },
              totalMinor: { type: 'integer' },
              paidMinor: { type: 'integer' },
              balanceMinor: { type: 'integer' },
              notes: { type: ['string', 'null'] },
              lines: { type: 'array', items: { type: 'object' } },
              payments: { type: 'array', items: { type: 'object' } },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          InvoiceList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/InvoiceDto' },
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
  const ctx = await requireWorkspace(event, 'invoice:read:any');
  const query = parseInvoiceListQuery(event.url.searchParams, requestId);
  return listInvoices(ctx, query);
});
