import { defineHandler, defineRouteMeta } from 'nitro';
import { getProjectBudgetUsage } from '~/server/utils/budgets.ts';
import { getRequestId } from '~/server/utils/catalog.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'Get project budget usage and alert level',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    parameters: [{ in: 'path', name: 'projectId', required: true, schema: { type: 'string' } }],
    responses: {
      200: {
        description: 'Budget usage',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProjectBudgetUsage' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
    $global: {
      components: {
        schemas: {
          ProjectBudgetUsage: {
            type: 'object',
            required: [
              'projectId',
              'projectName',
              'usedMinutes',
              'budgetMinutes',
              'usedAmountMinor',
              'budgetAmountMinor',
              'currency',
              'alertAtPercent',
              'hoursLevel',
              'moneyLevel',
              'hoursRatio',
              'moneyRatio',
            ],
            properties: {
              projectId: { type: 'string' },
              projectName: { type: 'string' },
              usedMinutes: { type: 'integer' },
              budgetMinutes: { type: ['integer', 'null'] },
              usedAmountMinor: { type: 'integer' },
              budgetAmountMinor: { type: ['integer', 'null'] },
              currency: { type: ['string', 'null'] },
              alertAtPercent: { type: 'integer', minimum: 1, maximum: 100 },
              hoursLevel: { type: 'string', enum: ['none', 'warning', 'exceeded'] },
              moneyLevel: { type: 'string', enum: ['none', 'warning', 'exceeded'] },
              hoursRatio: { type: ['number', 'null'] },
              moneyRatio: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const projectId = requireParam(event, 'projectId');
  return getProjectBudgetUsage(ctx, projectId, requestId);
});
