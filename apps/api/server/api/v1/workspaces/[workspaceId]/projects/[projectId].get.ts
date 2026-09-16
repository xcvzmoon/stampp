import { defineHandler } from 'nitro';
import { getRequestId } from '../../../../../utils/catalog.ts';
import { getProject } from '../../../../../utils/catalogService.ts';
import { requireParam, requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const projectId = requireParam(event, 'projectId');
  return getProject(ctx, projectId, requestId);
});
