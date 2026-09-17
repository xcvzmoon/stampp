import { defineHandler } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { timeSchemas } from '~/server/utils/time.ts';
import { updateTimeEntry } from '~/server/utils/timeTracking.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const entryId = requireParam(event, 'entryId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(timeSchemas.updateEntry, body, requestId);
  return updateTimeEntry(ctx, entryId, input, requestId);
});
