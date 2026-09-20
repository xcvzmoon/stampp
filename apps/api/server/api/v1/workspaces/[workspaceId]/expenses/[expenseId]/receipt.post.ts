import { ERROR_CODES } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { uploadExpenseReceipt } from '~/server/utils/expenses.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['expenses'],
    summary: 'Upload expense receipt',
    security: [{ sessionCookie: [] }],
    parameters: [{ in: 'path', name: 'expenseId', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file'],
            properties: {
              file: { type: 'string', format: 'binary' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Expense with receipt metadata',
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
  const ctx = await requireWorkspace(event, 'expense:write:own');
  const expenseId = requireParam(event, 'expenseId');
  const formData = await event.req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'file field is required', requestId);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return uploadExpenseReceipt(
    ctx,
    expenseId,
    {
      filename: file.name || 'receipt',
      contentType: file.type || 'application/octet-stream',
      bytes,
    },
    requestId,
  );
});
