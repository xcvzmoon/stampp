import { ERROR_CODES, utilizationQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getUtilizationReport, utilizationReportCsv } from '~/server/utils/advancedReports.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseUtilizationQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of ['from', 'to', 'timezone', 'projectId', 'userId', 'groupBy', 'format']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(utilizationQuerySchema, raw);
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
    summary: 'Utilization report (billable vs total hours)',
    security: [{ sessionCookie: [] }],
    parameters: [
      { in: 'query', name: 'from', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'to', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'timezone', required: true, schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      { in: 'query', name: 'groupBy', schema: { type: 'string', enum: ['user', 'project'] } },
      { in: 'query', name: 'format', schema: { type: 'string', enum: ['json', 'csv'] } },
    ],
    responses: {
      200: {
        description: 'Utilization report',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UtilizationReport' },
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
          UtilizationReport: {
            type: 'object',
            required: ['from', 'to', 'timezone', 'groupBy', 'totals', 'groups'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              timezone: { type: 'string' },
              groupBy: { type: 'string', enum: ['user', 'project'] },
              totals: { type: 'object' },
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
  const ctx = await requireWorkspace(event, 'reports:view');
  const query = parseUtilizationQuery(event.url.searchParams, requestId);
  const report = await getUtilizationReport(ctx, query, requestId);
  if (query.format === 'csv') {
    event.res.headers.set('content-type', 'text/csv; charset=utf-8');
    event.res.headers.set('content-disposition', 'attachment; filename="utilization.csv"');
    return utilizationReportCsv(report);
  }
  return report;
});
