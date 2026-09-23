import { defineHandler, defineRouteMeta } from 'nitro';
import { handleScimUsers } from '~/server/utils/scimService.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'SCIM 2.0 delete user membership',
    security: [{ scimToken: [] }],
    responses: {
      204: { description: 'Deleted' },
      401: { description: 'Invalid SCIM token' },
    },
  },
});

export default defineHandler(async (event) => handleScimUsers(event));
