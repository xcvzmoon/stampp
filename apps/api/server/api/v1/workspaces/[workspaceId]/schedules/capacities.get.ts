import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listCapacities } from '~/server/utils/scheduling.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scheduling'],
    summary: 'List member weekly capacities',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Member capacities',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CapacityList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          CapacityDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'weeklyHours',
              'note',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              weeklyHours: { type: 'number' },
              note: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          CapacityList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/CapacityDto' } },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          AssignmentDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'projectId',
              'startDate',
              'endDate',
              'hoursPerWeek',
              'note',
              'active',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              projectId: { type: 'string' },
              startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              hoursPerWeek: { type: 'number' },
              note: { type: ['string', 'null'] },
              active: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          AssignmentList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/AssignmentDto' } },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          WorkloadResult: {
            type: 'object',
            required: ['from', 'to', 'members'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              members: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'schedule:read:own');
  const limitParam = event.url.searchParams.get('limit');
  const cursor = event.url.searchParams.get('cursor');
  const userId = event.url.searchParams.get('userId');
  const parsedLimit = limitParam ? Number(limitParam) : 50;
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 200 ? parsedLimit : 50;
  return listCapacities(ctx, {
    limit,
    cursor: cursor ?? undefined,
    userId: userId ?? undefined,
  });
});
