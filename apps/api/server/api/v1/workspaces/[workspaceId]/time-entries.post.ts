import { defineHandler } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '../../../../utils/catalog.ts';
import { timeSchemas } from '../../../../utils/time.ts';
import { addManualTime } from '../../../../utils/timeTracking.ts';
import { requireWorkspace } from '../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(timeSchemas.addManual, body, requestId);
  const entry = await addManualTime(ctx, input, requestId);
  event.res.status = 201;
  return entry;
});
