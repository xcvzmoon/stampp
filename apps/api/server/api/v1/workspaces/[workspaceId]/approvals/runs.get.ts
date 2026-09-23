import { defineHandler, defineRouteMeta } from 'nitro';
import { listApprovalRuns, parseApprovalListQuery } from '~/server/utils/approvalChains.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'List approval runs',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'entityType',
        schema: { type: 'string', enum: ['timesheet', 'time_off_request'] },
      },
      { in: 'query', name: 'entityId', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'status',
        schema: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'canceled'],
        },
      },
    ],
    responses: {
      200: {
        description: 'Approval runs',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApprovalRunList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'approval:read');
  const query = parseApprovalListQuery(event.url.searchParams, requestId);
  return listApprovalRuns(ctx, query);
});
