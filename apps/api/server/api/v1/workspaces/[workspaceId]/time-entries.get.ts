import { defineHandler } from 'nitro';
import { getRequestId } from '../../../../utils/catalog.ts';
import { parseTimeEntryListQuery } from '../../../../utils/time.ts';
import { listTimeEntries } from '../../../../utils/timeTracking.ts';
import { requireWorkspace } from '../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:read:own');
  const query = parseTimeEntryListQuery(event.url.searchParams, requestId);
  return listTimeEntries(ctx, query);
});
