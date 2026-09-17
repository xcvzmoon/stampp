import { defineHandler } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateTask } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const taskId = requireParam(event, 'taskId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateTask, body, requestId);
  return updateTask(ctx, taskId, input, requestId);
});
