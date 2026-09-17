import { defineHandler } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createTask } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const projectId = requireParam(event, 'projectId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.createTask, body, requestId);
  const task = await createTask(ctx, projectId, input, requestId);
  event.res.status = 201;
  return task;
});
