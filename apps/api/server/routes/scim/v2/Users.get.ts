import { defineHandler, defineRouteMeta } from 'nitro';
import { handleScimUsers } from '~/server/utils/scimService.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'SCIM 2.0 Users collection',
    security: [{ scimToken: [] }],
    responses: {
      200: { description: 'ListResponse / User' },
      401: { description: 'Invalid SCIM token' },
    },
  },
});

export default defineHandler(async (event) => handleScimUsers(event));
