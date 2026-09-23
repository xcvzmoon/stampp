import { ERROR_CODES, workloadQuerySchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getWorkload, parseWorkloadQuery } from '~/server/utils/scheduling.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scheduling'],
    summary: 'Scheduled vs tracked workload',
    description: 'Weekly capacity, scheduled assignment hours, tracked time, and status flags.',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'from',
        required: true,
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      {
        in: 'query',
        name: 'to',
        required: true,
        schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      { in: 'query', name: 'userId', schema: { type: 'string' } },
    ],
    responses: {
      200: {
        description: 'Workload by member',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WorkloadResult' },
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationFailed' },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      422: {
        description: 'Invalid workload range',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'schedule:read:own');
  const raw = parseWorkloadQuery(event.url.searchParams, requestId);
  const parsed = v.safeParse(workloadQuerySchema, raw);
  if (!parsed.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'from and to must be calendar dates',
      requestId,
      parsed.issues,
    );
  }
  return getWorkload(ctx, parsed.output, requestId);
});
