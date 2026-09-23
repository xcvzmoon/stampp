import { defineHandler, defineRouteMeta } from 'nitro';
import { getRequestId } from '~/server/utils/catalog.ts';
import { listCustomRoles } from '~/server/utils/roles.ts';
import { requireWorkspace } from '~/server/utils/workspaceAccess.ts';

defineRouteMeta({
  openAPI: {
    tags: ['roles'],
    summary: 'List custom roles',
    security: [{ sessionCookie: [] }, { personalAccessToken: [] }],
    responses: {
      200: {
        description: 'Custom roles',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CustomRoleDto' },
                },
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
          CustomRoleDto: {
            type: 'object',
            required: [
              'id',
              'workspaceId',
              'name',
              'description',
              'permissions',
              'createdAt',
              'updatedAt',
            ],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string' },
              description: { type: ['string', 'null'] },
              permissions: { type: 'array', items: { type: 'string' } },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          WorkspaceMemberDto: {
            type: 'object',
            required: ['id', 'userId', 'name', 'email', 'role', 'customRoleId', 'customRoleName'],
            properties: {
              id: { type: 'string' },
              userId: { type: 'string' },
              name: { type: ['string', 'null'] },
              email: { type: 'string' },
              role: { type: 'string' },
              customRoleId: { type: ['string', 'null'] },
              customRoleName: { type: ['string', 'null'] },
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
  return listCustomRoles(ctx);
});
