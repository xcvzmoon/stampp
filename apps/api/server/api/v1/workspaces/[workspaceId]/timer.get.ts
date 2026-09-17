import { defineHandler } from 'nitro';
import { getRunningTimer } from '~/server/utils/timeTracking.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'time:read:own');
  return getRunningTimer(ctx);
});
