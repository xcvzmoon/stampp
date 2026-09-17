import { defineHandler } from 'nitro';
import {
  catalogSchemas,
  getRequestId,
  parseBody,
  readJsonBody,
} from '../../../../utils/catalog.ts';
import { createClient } from '../../../../utils/catalogService.ts';
import { requireWorkspace } from '../../../../utils/workspaceAccess.ts';

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'client:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(catalogSchemas.createClient, body, requestId);
  const client = await createClient(ctx, input, requestId);
  event.res.status = 201;
  return client;
});
