import { createInvoiceInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createInvoice } from '~/server/utils/invoices.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['invoices'],
    summary: 'Create draft invoice',
    security: [{ sessionCookie: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      201: {
        description: 'Created invoice',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/InvoiceDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      422: {
        description: 'Invoice business rule failed',
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
  const body = await readJsonBody(event, requestId);
  const input = parseBody(createInvoiceInputSchema, body, requestId);
  const invoice = await createInvoice(ctx, input, requestId);
  event.res.status = 201;
  return invoice;
});
