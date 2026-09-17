import { defineHandler } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { archiveProject } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const projectId = requireParam(event, 'projectId');
  await archiveProject(ctx, projectId, requestId);
  event.res.status = 204;
  return null;
});
