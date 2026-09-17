import { defineHandler } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getClient } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'client:read');
  const clientId = requireParam(event, 'clientId');
  return getClient(ctx, clientId, requestId);
});
