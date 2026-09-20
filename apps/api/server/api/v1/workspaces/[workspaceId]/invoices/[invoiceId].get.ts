import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getInvoice } from '~/server/utils/invoices.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['invoices'],
    summary: 'Get invoice',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'invoiceId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Invoice',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/InvoiceDto' },
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
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'invoice:read:any');
  const invoiceId = requireParam(event, 'invoiceId');
  return getInvoice(ctx, invoiceId, requestId);
});
