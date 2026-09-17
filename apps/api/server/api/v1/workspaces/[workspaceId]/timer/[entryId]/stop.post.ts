import { defineHandler } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { stopTimer } from '~/server/utils/timeTracking.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const entryId = requireParam(event, 'entryId');
  return stopTimer(ctx, entryId, requestId);
});
