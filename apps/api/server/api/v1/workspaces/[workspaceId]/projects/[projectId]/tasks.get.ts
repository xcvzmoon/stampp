import { defineHandler } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listProjectTasks } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const projectId = requireParam(event, 'projectId');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listProjectTasks(
    ctx,
    projectId,
    { limit: query.limit, cursor: query.cursor, search: query.search },
    requestId,
  );
});
