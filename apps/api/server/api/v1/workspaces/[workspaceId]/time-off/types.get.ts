import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listTimeOffTypes } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'List time-off types',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'activeOnly', schema: { type: 'boolean' } },
    ],
    responses: {
      200: {
        description: 'Time-off types',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffTypeList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          TimeOffTypeDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'color',
              'paid',
              'annualAllowanceDays',
              'requiresApproval',
              'active',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              color: { type: ['string', 'null'] },
              paid: { type: 'boolean' },
              annualAllowanceDays: { type: ['number', 'null'] },
              requiresApproval: { type: 'boolean' },
              active: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          TimeOffTypeList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/TimeOffTypeDto' } },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          HolidayDto: {
            type: 'object',
            required: ['id', 'workspaceId', 'name', 'date', 'createdAt', 'updatedAt'],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          HolidayList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/HolidayDto' } },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          TimeOffRequestDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'timeOffTypeId',
              'startDate',
              'endDate',
              'days',
              'status',
              'note',
              'decidedAt',
              'decidedBy',
              'decisionNote',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              timeOffTypeId: { type: 'string' },
              startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              days: { type: 'number' },
              status: {
                type: 'string',
                enum: ['pending', 'approved', 'rejected', 'canceled'],
              },
              note: { type: ['string', 'null'] },
              decidedAt: { type: ['string', 'null'], format: 'date-time' },
              decidedBy: { type: ['string', 'null'] },
              decisionNote: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          TimeOffRequestList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/TimeOffRequestDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          TimeOffBalanceDto: {
            type: 'object',
            required: [
              'timeOffTypeId',
              'name',
              'color',
              'paid',
              'allowanceDays',
              'approvedDays',
              'pendingDays',
              'usedDays',
              'remainingDays',
            ],
            properties: {
              timeOffTypeId: { type: 'string' },
              name: { type: 'string' },
              color: { type: ['string', 'null'] },
              paid: { type: 'boolean' },
              allowanceDays: { type: ['number', 'null'] },
              approvedDays: { type: 'number' },
              pendingDays: { type: 'number' },
              usedDays: { type: 'number' },
              remainingDays: { type: ['number', 'null'] },
            },
          },
          TimeOffBalanceList: {
            type: 'object',
            required: ['year', 'items'],
            properties: {
              year: { type: 'integer' },
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/TimeOffBalanceDto' },
              },
            },
          },
          TimeOffCalendarResult: {
            type: 'object',
            required: ['from', 'to', 'days'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              days: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:read:own');
  const limitParam = event.url.searchParams.get('limit');
  const cursor = event.url.searchParams.get('cursor');
  const activeOnly = event.url.searchParams.get('activeOnly') === 'true';
  const parsedLimit = limitParam ? Number(limitParam) : 50;
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 200 ? parsedLimit : 50;
  return listTimeOffTypes(ctx, { limit, cursor: cursor ?? undefined, activeOnly });
});
