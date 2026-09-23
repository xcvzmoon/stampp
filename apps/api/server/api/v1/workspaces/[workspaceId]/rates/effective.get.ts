import { ERROR_CODES, resolveRatesQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { resolveRates } from '~/server/utils/rates.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

function parseResolveQuery(query: URLSearchParams, requestId: string) {
  const raw: Record<string, string> = {};
  for (const key of ['at', 'userId', 'projectId', 'taskId']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(resolveRatesQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return result.output;
}

defineRouteMeta({
  openAPI: {
    tags: ['rates'],
    summary: 'Resolve effective rates as of a point in time',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'at',
        schema: { type: 'string', format: 'date-time' },
        description: 'ISO-8601 instant; defaults to now',
      },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
      { in: 'query', name: 'projectId', schema: { type: 'string' } },
      { in: 'query', name: 'taskId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Effective rates',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/EffectiveRatesDto' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      422: {
        description: 'Invalid target or currency mismatch',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'reports:view:cost');
  const query = parseResolveQuery(event.url.searchParams, requestId);
  return resolveRates(ctx, query, requestId);
});
