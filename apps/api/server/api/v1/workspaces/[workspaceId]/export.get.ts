import { defineHandler, defineRouteMeta } from 'nitro';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';
import { exportWorkspace } from '~/server/utils/workspaceExport.ts';

defineRouteMeta({
  openAPI: {
    tags: ['workspace'],
    summary: 'Export workspace JSON',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Workspace export attachment',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                format: { type: 'string', enum: ['stampp-workspace-export'] },
                version: { type: 'integer' },
                exportedAt: { type: 'string', format: 'date-time' },
                workspace: {},
                members: { type: 'array' },
                invitations: { type: 'array' },
                clients: { type: 'array' },
                projects: { type: 'array' },
                tasks: { type: 'array' },
                tags: { type: 'array' },
                timeEntries: { type: 'array' },
                timeEntryTags: { type: 'array' },
                attendanceRecords: { type: 'array' },
                timeOffTypes: { type: 'array' },
                holidays: { type: 'array' },
                timeOffRequests: { type: 'array' },
                memberCapacities: { type: 'array' },
                projectAssignments: { type: 'array' },
                kioskDevices: { type: 'array' },
                kioskCredentials: { type: 'array' },
                approvalChains: { type: 'array' },
                approvalRuns: { type: 'array' },
                approvalDecisions: { type: 'array' },
                auditEvents: { type: 'array' },
              },
            },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

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
