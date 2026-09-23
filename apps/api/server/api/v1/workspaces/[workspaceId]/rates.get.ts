import { DEFAULT_LIST_LIMIT, ERROR_CODES, rateListQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listRates } from '~/server/utils/rates.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseRateListQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'kind', 'scope', 'projectId', 'userId']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(rateListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return {
    ...result.output,
    limit: result.output.limit ?? DEFAULT_LIST_LIMIT,
  };
}

defineRouteMeta({
  openAPI: {
    tags: ['rates'],
    summary: 'List rate versions',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'kind', schema: { type: 'string', enum: ['billable', 'cost'] } },
      {
        in: 'query',
        name: 'scope',
        schema: {
          type: 'string',
          enum: ['org', 'user', 'project', 'user_project', 'task'],
        },
      },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Rate versions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RateList' },
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
          RateDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'kind',
              'scope',
              'userId',
              'projectId',
              'taskId',
              'amountMinor',
              'currency',
              'effectiveFrom',
              'effectiveTo',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              kind: { type: 'string', enum: ['billable', 'cost'] },
              scope: {
                type: 'string',
                enum: ['org', 'user', 'project', 'user_project', 'task'],
              },
              userId: { type: ['string', 'null'] },
              projectId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
              amountMinor: { type: 'integer', minimum: 0 },
              currency: { type: 'string', minLength: 3, maxLength: 3 },
              effectiveFrom: { type: 'string', format: 'date-time' },
              effectiveTo: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          EffectiveRatesDto: {
            type: 'object',
            required: [
              'billable',
              'cost',
              'currency',
              'source',
              'at',
              'userId',
              'projectId',
              'taskId',
            ],
            properties: {
              billable: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['amountMinor', 'currency'],
                    properties: {
                      amountMinor: { type: 'integer' },
                      currency: { type: 'string' },
                    },
                  },
                  { type: 'null' },
                ],
              },
              cost: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['amountMinor', 'currency'],
                    properties: {
                      amountMinor: { type: 'integer' },
                      currency: { type: 'string' },
                    },
                  },
                  { type: 'null' },
                ],
              },
              currency: { type: 'string' },
              source: {
                type: 'string',
                enum: ['task', 'project', 'user_project', 'user', 'org', 'none'],
              },
              at: { type: 'string', format: 'date-time' },
              userId: { type: ['string', 'null'] },
              projectId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
            },
          },
          RateList: {
            type: 'object',
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/RateDto' },
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
  const ctx = await requireWorkspace(event, 'settings:manage');
  const query = parseRateListQuery(event.url.searchParams, requestId);
  return listRates(ctx, query);
});
