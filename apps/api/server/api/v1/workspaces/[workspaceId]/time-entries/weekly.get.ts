import { defineHandler } from 'nitro';
import { getRequestId } from '../../../../../utils/catalog.ts';
import { parseWeeklyTimeQuery } from '../../../../../utils/time.ts';
import { getWeeklyTimeSummary } from '../../../../../utils/timeTracking.ts';
import { requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:read:own');
  const query = parseWeeklyTimeQuery(event.url.searchParams, requestId);
  return getWeeklyTimeSummary(ctx, query);
});
