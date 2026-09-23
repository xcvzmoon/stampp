import { updateAuditRetentionInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { purgeExpiredAuditEvents, setAuditRetention } from '~/server/utils/auditUi.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['audit'],
    summary: 'Get or update audit retention policy',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      200: {
        description: 'Retention policy',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuditRetentionDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  const body = await readJsonBody(event, requestId);
  const input = parseBody(updateAuditRetentionInputSchema, body, requestId);
  const policy = await setAuditRetention(ctx, input.retentionDays, requestId);
  await purgeExpiredAuditEvents(ctx, input.retentionDays);
  return policy;
});
