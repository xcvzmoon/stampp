import { createImportPreviewInputSchema, startImportInputSchema } from '@stampp/shared';
import { defineHandler, defineRouteMeta } from 'nitro';
import { processImportJob } from '~/server/plugins/import-worker.ts';
import { getRequestId, parseBody, readJsonBody } from '~/server/utils/catalog.ts';
import { buildImportPreview, startImportJob } from '~/server/utils/importService.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: 'header',
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 255 },
      },
    ],
    tags: ['import'],
    summary: 'Preview or start an import job',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      200: { description: 'Dry-run preview' },
      201: {
        description: 'Created import job',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ImportJobDto' },
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
  const ctx = await requireWorkspace(event, 'settings:manage');
  const body = await readJsonBody(event, requestId);
  const mode = event.url.searchParams.get('mode');

  if (mode === 'preview') {
    const input = parseBody(createImportPreviewInputSchema, body, requestId);
    return buildImportPreview(input.source, input.csv, input.startDate, input.endDate);
  }

  const input = parseBody(startImportInputSchema, body, requestId);
  const job = await startImportJob(ctx, input, requestId, async ({ jobId, workspaceId }) => {
    await processImportJob(jobId, workspaceId);
  });
  event.res.status = 201;
  return job;
});
