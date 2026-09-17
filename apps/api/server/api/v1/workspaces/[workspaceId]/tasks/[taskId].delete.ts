import { defineHandler } from 'nitro';
import { getRequestId } from '../../../../../utils/catalog.ts';
import { archiveTask } from '../../../../../utils/catalogService.ts';
import { requireParam, requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const taskId = requireParam(event, 'taskId');
  await archiveTask(ctx, taskId, requestId);
  event.res.status = 204;
  return null;
});
