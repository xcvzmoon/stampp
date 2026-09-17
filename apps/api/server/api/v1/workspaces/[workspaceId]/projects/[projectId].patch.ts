import { defineHandler } from 'nitro';
import {
  catalogSchemas,
  getRequestId,
  parseBody,
  readJsonBody,
} from '../../../../../utils/catalog.ts';
import { updateProject } from '../../../../../utils/catalogService.ts';
import { requireParam, requireWorkspace } from '../../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:manage');
  const projectId = requireParam(event, 'projectId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateProject, body, requestId);
  return updateProject(ctx, projectId, input, requestId);
});
