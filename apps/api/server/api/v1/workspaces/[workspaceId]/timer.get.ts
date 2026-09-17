import { defineHandler } from 'nitro';
import { getRunningTimer } from '../../../../utils/timeTracking.ts';
import { requireWorkspace } from '../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'time:read:own');
  return getRunningTimer(ctx);
});
