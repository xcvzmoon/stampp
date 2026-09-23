import { ERROR_CODES, timeOffBalanceQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listTimeOffBalances } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'List time-off balances for a year',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'year',
        required: true,
        schema: { type: 'integer', minimum: 2000, maximum: 2100 },
      },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Balances by time-off type',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TimeOffBalanceList' },
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
  const ctx = await requireWorkspace(event, 'timeoff:read:own');
  const raw: Record<string, string> = {};
  const year = event.url.searchParams.get('year');
  const userId = event.url.searchParams.get('userId');
  if (year !== null) raw.year = year;
  if (userId !== null) raw.userId = userId;
  const parsed = v.safeParse(timeOffBalanceQuerySchema, raw);
  if (!parsed.success) {
    throw toApiError(ERROR_CODES.VALIDATION_FAILED, 'year is required', requestId, parsed.issues);
  }
  return listTimeOffBalances(ctx, parsed.output, requestId);
});
