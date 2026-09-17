import { defineHandler } from 'nitro';
import { requireWorkspace } from '../../../../utils/workspaceAccess.ts';
import { exportWorkspace } from '../../../../utils/workspaceExport.ts';

export default defineHandler(async (event) => {
  const ctx = await requireWorkspace(event, 'export:workspace');
  const payload = await exportWorkspace(ctx);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-disposition': `attachment; filename="stampp-workspace-${ctx.workspaceId}.json"`,
      'content-type': 'application/json; charset=utf-8',
    },
  });
});
