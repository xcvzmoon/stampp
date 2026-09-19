import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import {
  buildDetailedReport,
  detailedReportCsv,
  loadReportRows,
  parseReportQuery,
} from '~/server/utils/reports.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['reports'],
    summary: 'Detailed report',
    security: [{ sessionCookie: [] }],
    parameters: [
      { in: 'query', name: 'from', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'to', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'timezone', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'clientId', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'billable',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
      {
        in: 'query',
        name: 'format',
        schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
      },
    ],
    responses: {
      200: {
        description: 'Detailed report JSON or CSV',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                timezone: { type: 'string' },
                totals: { $ref: '#/components/schemas/ReportTotals' },
                entries: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          'text/csv': { schema: { type: 'string' } },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'reports:view');
  const query = parseReportQuery(event.url.searchParams, requestId);
  const report = buildDetailedReport(await loadReportRows(ctx, query), query);
  if (query.format === 'csv') {
    return new Response(detailedReportCsv(report), {
      headers: {
        'content-disposition': 'attachment; filename="detailed-report.csv"',
        'content-type': 'text/csv; charset=utf-8',
      },
    });
  }
  return report;
});
