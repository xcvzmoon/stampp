import { defineHandler } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { createTag } from '~/server/utils/catalogService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'tag:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.createTag, body, requestId);
  const tag = await createTag(ctx, input, requestId);
  event.res.status = 201;
  return tag;
});
