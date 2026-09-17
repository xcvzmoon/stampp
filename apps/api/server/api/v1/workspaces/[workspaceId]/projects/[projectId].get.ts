import { defineHandler } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getProject } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const projectId = requireParam(event, 'projectId');
  return getProject(ctx, projectId, requestId);
});
