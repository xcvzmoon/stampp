import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { getProject } from '~/server/utils/catalogService.ts';
import { requireParam, requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'Get project',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Project',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProjectDto' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthenticated' },
      429: { $ref: '#/components/responses/RateLimited' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
});

export default defineHandler(async (event) => {
  const requestId = getRequestId(event);
  const ctx = await requireWorkspace(event, 'project:read');
  const projectId = requireParam(event, 'projectId');
  return getProject(ctx, projectId, requestId);
});
