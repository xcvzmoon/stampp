import { defineHandler } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { timeSchemas } from '~/server/utils/time.ts';
import { addManualTime } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(timeSchemas.addManual, body, requestId);
  const entry = await addManualTime(ctx, input, requestId);
  event.res.status = 201;
  return entry;
});
