import { defineHandler } from 'nitro';
import { getRequestId, parseListQuery } from '../../../../utils/catalog.ts';
import { listProjects } from '../../../../utils/catalogService.ts';
import { requireWorkspace } from '../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listProjects(ctx, {
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
    status: query.status,
    clientId: query.clientId,
  });
});
