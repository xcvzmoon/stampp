import { defineHandler } from 'nitro';
import { getRequestId, parseBody, readJsonBody } from '../../../../../utils/catalog.ts';
import { timeSchemas, validateCopyPreviousWeekInput } from '../../../../../utils/time.ts';
import { copyPreviousWeek } from '../../../../../utils/timeTracking.ts';
import { requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:write:own');
  const body = await readJsonBody(event, requestId);
  const parsed = parseBody(timeSchemas.copyPreviousWeek, body, requestId);
  const input = validateCopyPreviousWeekInput(parsed, requestId);
  return copyPreviousWeek(ctx, input, requestId);
});
