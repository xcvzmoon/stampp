import { defineHandler } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { archiveTag } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'tag:manage');
  const tagId = requireParam(event, 'tagId');
  await archiveTag(ctx, tagId, requestId);
  event.res.status = 204;
  return null;
});
