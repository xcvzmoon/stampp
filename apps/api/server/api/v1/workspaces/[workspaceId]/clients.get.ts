import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId, parseListQuery } from '~/server/utils/catalog.ts';
import { listClients } from '~/server/utils/catalogService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['clients'],
    summary: 'List clients',
    security: [{ sessionCookie: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'search', schema: { type: 'string', maxLength: 200 } },
    ],
    responses: {
      200: {
        description: 'Workspace clients',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ClientList',
            },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
    $global: {
      components: {
        securitySchemes: {
          sessionCookie: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
            description: 'Better Auth session cookie. Obtain via /api/auth/*.',
          },
          kioskDeviceKey: {
            type: 'apiKey',
            in: 'header',
            name: 'x-kiosk-device-key',
            description:
              'Registered kiosk device key returned once at device registration. Combined with member PIN or QR for attendance punches.',
          },
        },
        schemas: {
          ApiError: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string' },
            },
          },
          ClientDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'email',
              'address',
              'notes',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              email: { type: ['string', 'null'] },
              address: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          ProjectDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'clientId',
              'name',
              'code',
              'color',
              'status',
              'billable',
              'notes',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              clientId: { type: ['string', 'null'] },
              name: { type: 'string' },
              code: { type: ['string', 'null'] },
              color: { type: ['string', 'null'] },
              status: { type: 'string', enum: ['active', 'archived'] },
              billable: { type: 'boolean' },
              notes: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          TaskDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'projectId',
              'name',
              'status',
              'estimateMinutes',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              projectId: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['active', 'archived'] },
              estimateMinutes: { type: ['integer', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          TagDto: {
            type: 'object',
            required: ['id', 'workspaceId', 'name', 'createdAt', 'updatedAt'],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string', maxLength: 50 },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          TimeEntryTagRef: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          TimeEntryDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'userId',
              'projectId',
              'taskId',
              'description',
              'billable',
              'startAt',
              'endAt',
              'durationMinutes',
              'workDate',
              'timezone',
              'tags',
              'lockedAt',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              userId: { type: 'string' },
              projectId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
              description: { type: 'string' },
              billable: { type: 'boolean' },
              startAt: { type: ['string', 'null'], format: 'date-time' },
              endAt: { type: ['string', 'null'], format: 'date-time' },
              durationMinutes: { type: ['integer', 'null'] },
              workDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              timezone: { type: 'string' },
              tags: {
                type: 'array',
                items: { $ref: '#/components/schemas/TimeEntryTagRef' },
              },
              lockedAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          ClientList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ClientDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          ProjectList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ProjectDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          TaskList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/TaskDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          TagList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/TagDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          TimeEntryList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/TimeEntryDto' },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
        responses: {
          Unauthenticated: {
            description: 'Missing or invalid session',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          Forbidden: {
            description: 'Authenticated but not permitted in this workspace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          NotFound: {
            description: 'Resource not found or not visible in this workspace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          ValidationFailed: {
            description: 'Request failed schema validation',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
          Conflict: {
            description: 'Unique constraint or state conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'client:read');
  const query = parseListQuery(event.url.searchParams, requestId);
  return listClients(ctx, {
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
  });
});
