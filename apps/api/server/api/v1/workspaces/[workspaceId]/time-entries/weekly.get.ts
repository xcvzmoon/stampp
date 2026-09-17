import { defineHandler } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { parseWeeklyTimeQuery } from '~/server/utils/time.ts';
import { getWeeklyTimeSummary } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:read:own');
  const query = parseWeeklyTimeQuery(event.url.searchParams, requestId);
  return getWeeklyTimeSummary(ctx, query);
});
