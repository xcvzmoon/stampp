import { defineHandler, defineRouteMeta } from 'nitro';
import { getAuditRetention } from '~/server/utils/auditUi.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['audit'],
    summary: 'Get audit retention policy',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Retention policy',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuditRetentionDto' },
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
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  return getAuditRetention(ctx);
});
