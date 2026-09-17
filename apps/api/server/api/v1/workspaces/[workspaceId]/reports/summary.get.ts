import { defineHandler } from 'nitro';
import { getRequestId } from '../../../../../utils/catalog.ts';
import {
  buildSummaryReport,
  loadReportRows,
  parseReportQuery,
  summaryReportCsv,
} from '../../../../../utils/reports.ts';
import { requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

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
