import { invoiceStatusActionSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { transitionInvoice } from '~/server/utils/invoices.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['invoices'],
    summary: 'Send, pay, or void an invoice',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
        description:
          'Optional client-generated key. Replays the stored response for safe retries on mutations.',
      },
      { in: 'path', name: 'invoiceId', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      200: {
        description: 'Invoice after transition',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/InvoiceDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: {
        description: 'Invalid status transition',
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
  const ctx = await requireWorkspace(event, 'invoice:manage');
  const invoiceId = requireParam(event, 'invoiceId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(invoiceStatusActionSchema, body, requestId);
  return transitionInvoice(ctx, invoiceId, input.action, requestId);
});
