import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listHolidays } from '~/server/utils/timeOff.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['time-off'],
    summary: 'List workspace holidays',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      { in: 'query', name: 'cursor', schema: { type: 'string' } },
      { in: 'query', name: 'from', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      { in: 'query', name: 'to', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
    ],
    responses: {
      200: {
        description: 'Holidays',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HolidayList' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'timeoff:read:own');
  const limitParam = event.url.searchParams.get('limit');
  const cursor = event.url.searchParams.get('cursor');
  const from = event.url.searchParams.get('from');
  const to = event.url.searchParams.get('to');
  const parsedLimit = limitParam ? Number(limitParam) : 50;
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 200 ? parsedLimit : 50;
  return listHolidays(ctx, {
    limit,
    cursor: cursor ?? undefined,
    from: from ?? undefined,
    to: to ?? undefined,
  });
});
