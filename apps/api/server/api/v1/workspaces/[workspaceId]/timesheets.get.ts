import { DEFAULT_LIST_LIMIT, ERROR_CODES, timesheetListQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listTimesheets } from '~/server/utils/timesheets.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseTimesheetListQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of ['weekStart', 'userId', 'status', 'limit', 'cursor']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(timesheetListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return { ...result.output, limit: result.output.limit ?? DEFAULT_LIST_LIMIT };
}

defineRouteMeta({
  openAPI: {
    tags: ['timesheets'],
    summary: 'List timesheet approvals',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'weekStart',
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      {
        in: 'query',
        name: 'status',
        schema: { type: 'string', enum: ['submitted', 'approved', 'rejected'] },
      },
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Timesheet approvals',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimesheetList' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        schemas: {
          TimesheetDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'weekStart',
              'status',
              'submittedAt',
              'submitNote',
              'decidedAt',
              'decidedBy',
              'decisionNote',
              'lockedAt',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              weekStart: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              status: { type: 'string', enum: ['submitted', 'approved', 'rejected'] },
              submittedAt: { type: ['string', 'null'], format: 'date-time' },
              submitNote: { type: ['string', 'null'] },
              decidedAt: { type: ['string', 'null'], format: 'date-time' },
              decidedBy: { type: ['string', 'null'] },
              decisionNote: { type: ['string', 'null'] },
              lockedAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          OwnTimesheetState: {
            type: 'object',
            required: ['weekStart', 'status', 'timesheet', 'editable'],
            properties: {
              weekStart: { type: 'string' },
              status: {
                type: ['string', 'null'],
                enum: ['submitted', 'approved', 'rejected', null],
              },
              timesheet: {
                oneOf: [{ $ref: '#/components/schemas/TimesheetDto' }, { type: 'null' }],
              },
              editable: { type: 'boolean' },
            },
          },
          TimesheetList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/TimesheetDto' },
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
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'time:read:team');
  const query = parseTimesheetListQuery(event.url.searchParams, requestId);
  return listTimesheets(ctx, query);
});
