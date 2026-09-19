import { defineHandler } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateTag } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'tag:manage');
  const tagId = requireParam(event, 'tagId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateTag, body, requestId);
  return updateTag(ctx, tagId, input, requestId);
});
