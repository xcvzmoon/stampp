import { defineHandler } from 'nitro';
import { getRequestId } from '../../../../../utils/catalog.ts';
import {
  buildDetailedReport,
  detailedReportCsv,
  loadReportRows,
  parseReportQuery,
} from '../../../../../utils/reports.ts';
import { requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

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
