import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listImportJobs } from '~/server/utils/importService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['import'],
    summary: 'List import jobs',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Import jobs',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/ImportJobDto' } },
              },
            },
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
          ImportJobDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'source',
              'status',
              'totalRows',
              'importedRows',
              'skippedRows',
              'error',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              source: { type: 'string', enum: ['csv', 'clockify', 'toggl', 'harvest'] },
              status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
              totalRows: { type: 'integer' },
              importedRows: { type: 'integer' },
              skippedRows: { type: 'integer' },
              error: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  getRequestId(event);
  const ctx = await requireWorkspace(event, 'settings:manage');
  return listImportJobs(ctx);
});
