import { defineHandler, defineRouteMeta } from 'nitro';
import { listApprovalChains } from '~/server/utils/approvalChains.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['approvals'],
    summary: 'List approval chains',
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
    ],
    responses: {
      200: {
        description: 'Approval chains',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApprovalChainList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          ApprovalChainDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'entityType',
              'active',
              'steps',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              entityType: { type: 'string', enum: ['timesheet', 'time_off_request'] },
              active: { type: 'boolean' },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['order', 'approverUserId'],
                  properties: {
                    order: { type: 'integer', minimum: 1, maximum: 5 },
                    approverUserId: { type: ['string', 'null'] },
                  },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          ApprovalChainList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ApprovalChainDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          ApprovalRunDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'chainId',
              'entityType',
              'entityId',
              'status',
              'currentStep',
              'stepCount',
              'submittedBy',
              'submittedAt',
              'decidedAt',
              'decidedBy',
              'decisionNote',
              'canAct',
              'steps',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              chainId: { type: 'string' },
              entityType: { type: 'string', enum: ['timesheet', 'time_off_request'] },
              entityId: { type: 'string' },
              status: {
                type: 'string',
                enum: ['pending', 'approved', 'rejected', 'canceled'],
              },
              currentStep: { type: 'integer' },
              stepCount: { type: 'integer' },
              submittedBy: { type: 'string' },
              submittedAt: { type: 'string', format: 'date-time' },
              decidedAt: { type: ['string', 'null'], format: 'date-time' },
              decidedBy: { type: ['string', 'null'] },
              decisionNote: { type: ['string', 'null'] },
              canAct: { type: 'boolean' },
              steps: { type: 'array', items: { type: 'object' } },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          ApprovalRunList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ApprovalRunDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'approval:read');
  const limitParam = event.url.searchParams.get('limit');
  const cursor = event.url.searchParams.get('cursor');
  const entityType = event.url.searchParams.get('entityType');
  const parsedLimit = limitParam ? Number(limitParam) : 50;
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 200 ? parsedLimit : 50;
  return listApprovalChains(ctx, {
    limit,
    cursor: cursor ?? undefined,
    entityType:
      entityType === 'timesheet' || entityType === 'time_off_request' ? entityType : undefined,
  });
});
