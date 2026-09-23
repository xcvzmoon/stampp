import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import {
  buildSummaryReport,
  loadReportRows,
  parseReportQuery,
  summaryReportCsv,
} from '~/server/utils/reports.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['reports'],
    summary: 'Summary report',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
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
        name: 'groupBy',
        schema: { type: 'string', enum: ['project', 'client', 'user'], default: 'project' },
      },
      {
        in: 'query',
        name: 'format',
        schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
      },
    ],
    responses: {
      200: {
        description: 'Summary report JSON or CSV',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                timezone: { type: 'string' },
                groupBy: { type: 'string' },
                totals: { $ref: '#/components/schemas/ReportTotals' },
                groups: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          'text/csv': { schema: { type: 'string' } },
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
          ReportTotals: {
            type: 'object',
            required: ['totalMinutes', 'billableMinutes', 'nonBillableMinutes'],
            properties: {
              totalMinutes: { type: 'integer', minimum: 0 },
              billableMinutes: { type: 'integer', minimum: 0 },
              nonBillableMinutes: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'reports:view');
  const query = parseReportQuery(event.url.searchParams, requestId);
  const report = buildSummaryReport(await loadReportRows(ctx, query), query);
  if (query.format === 'csv') {
    return new Response(summaryReportCsv(report), {
      headers: {
        'content-disposition': 'attachment; filename="summary-report.csv"',
        'content-type': 'text/csv; charset=utf-8',
      },
    });
  }
  return report;
});
