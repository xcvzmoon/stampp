import { defineHandler, defineRouteMeta } from 'nitro';
import { handleScimUsers } from '~/server/utils/scimService.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'SCIM 2.0 user by id',
    security: [{ scimToken: [] }],
    responses: {
      200: { description: 'User' },
      401: { description: 'Invalid SCIM token' },
      404: { description: 'Not found' },
    },
  },
});

export default defineHandler(async (event) => handleScimUsers(event));
