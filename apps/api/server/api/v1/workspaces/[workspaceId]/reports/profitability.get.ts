import { ERROR_CODES, profitabilityQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getProfitabilityReport, profitabilityReportCsv } from '~/server/utils/advancedReports.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseProfitabilityQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of ['from', 'to', 'timezone', 'projectId', 'groupBy', 'format']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(profitabilityQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return result.output;
}

defineRouteMeta({
  openAPI: {
    tags: ['reports'],
    summary: 'Profitability report using billable and cost rates',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      { in: 'query', name: 'from', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'to', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'timezone', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'groupBy', schema: { type: 'string', enum: ['project', 'user'] } },
      { in: 'query', name: 'format', schema: { type: 'string', enum: ['json', 'csv'] } },
    ],
    responses: {
      200: {
        description: 'Profitability report',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProfitabilityReport' },
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
          MarginTotals: {
            type: 'object',
            required: [
              'revenueMinor',
              'laborCostMinor',
              'expenseMinor',
              'profitMinor',
              'marginRatio',
            ],
            properties: {
              revenueMinor: { type: 'integer' },
              laborCostMinor: { type: 'integer' },
              expenseMinor: { type: 'integer' },
              profitMinor: { type: 'integer' },
              marginRatio: { type: ['number', 'null'] },
            },
          },
          ProfitabilityReport: {
            type: 'object',
            required: ['from', 'to', 'timezone', 'groupBy', 'currency', 'totals', 'groups'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              timezone: { type: 'string' },
              groupBy: { type: 'string', enum: ['project', 'user'] },
              currency: { type: 'string' },
              totals: { $ref: '#/components/schemas/MarginTotals' },
              groups: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'reports:view:cost');
  const query = parseProfitabilityQuery(event.url.searchParams, requestId);
  const report = await getProfitabilityReport(ctx, query, requestId);
  if (query.format === 'csv') {
    event.res.headers.set('content-type', 'text/csv; charset=utf-8');
    event.res.headers.set('content-disposition', 'attachment; filename="profitability.csv"');
    return profitabilityReportCsv(report);
  }
  return report;
});
