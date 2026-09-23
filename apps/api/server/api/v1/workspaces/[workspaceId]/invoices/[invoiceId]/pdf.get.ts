import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { renderInvoicePdf } from '~/server/utils/invoicePdf.ts';
import { loadInvoicePdfInput } from '~/server/utils/invoices.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['invoices'],
    summary: 'Download invoice PDF',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'invoiceId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Invoice PDF',
        content: {
          'application/pdf': { schema: { type: 'string', format: 'binary' } },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'invoice:read:any');
  const invoiceId = requireParam(event, 'invoiceId');
  const invoice = await loadInvoicePdfInput(ctx, invoiceId, requestId);
  const pdf = await renderInvoicePdf(invoice);
  event.res.headers.set('content-type', 'application/pdf');
  event.res.headers.set('content-disposition', `attachment; filename="${invoice.number}.pdf"`);
  return Buffer.from(pdf);
});
