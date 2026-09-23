import { defineHandler, defineRouteMeta } from 'nitro';
import { exportAuditEventsCsv } from '~/server/utils/auditUi.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['audit'],
    summary: 'Export workspace audit events as CSV',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'CSV export',
        content: { 'text/csv': { schema: { type: 'string' } } },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'export:workspace');
  const csv = await exportAuditEventsCsv(ctx);
  event.res.headers.set('content-type', 'text/csv; charset=utf-8');
  event.res.headers.set(
    'content-disposition',
    `attachment; filename="stampp-audit-${ctx.workspaceId}.csv"`,
  );
  return csv;
});
