import { defineHandler } from 'nitro';
import { catalogSchemas, getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { updateClient } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'client:manage');
  const clientId = requireParam(event, 'clientId');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.updateClient, body, requestId);
  return updateClient(ctx, clientId, input, requestId);
});
