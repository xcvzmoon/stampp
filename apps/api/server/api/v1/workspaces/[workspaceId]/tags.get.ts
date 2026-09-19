import { defineHandler } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listTags } from '~/server/utils/catalogService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'tag:read');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listTags(ctx, {
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
  });
});
