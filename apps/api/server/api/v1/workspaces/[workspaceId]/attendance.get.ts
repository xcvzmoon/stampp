import { defineHandler, defineRouteMeta } from 'nitro';
import { listAttendance, parseAttendanceListQuery } from '~/server/utils/attendance.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['attendance'],
    summary: 'List attendance records',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'from',
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      {
        in: 'query',
        name: 'to',
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    ],
    responses: {
      200: {
        description: 'Attendance records visible to the caller',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AttendanceList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          AttendanceDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'clockInAt',
              'clockOutAt',
              'durationMinutes',
              'workDate',
              'timezone',
              'source',
              'note',
              'state',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              clockInAt: { type: 'string', format: 'date-time' },
              clockOutAt: { type: ['string', 'null'], format: 'date-time' },
              durationMinutes: { type: ['integer', 'null'] },
              workDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              timezone: { type: 'string' },
              source: { type: 'string', enum: ['clock', 'manual'] },
              note: { type: ['string', 'null'] },
              state: { type: 'string', enum: ['open', 'closed'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          AttendanceList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/AttendanceDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          CurrentAttendance: {
            type: 'object',
            required: ['clockedIn', 'record', 'elapsedMinutes'],
            properties: {
              clockedIn: { type: 'boolean' },
              record: {
                oneOf: [{ $ref: '#/components/schemas/AttendanceDto' }, { type: 'null' }],
              },
              elapsedMinutes: { type: ['integer', 'null'] },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'attendance:read:own');
  const query = parseAttendanceListQuery(event.url.searchParams, requestId);
  return listAttendance(ctx, query);
});
