import { defineHandler, defineRouteMeta } from 'nitro';
import { handleScimGroups } from '~/server/utils/scimService.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'SCIM 2.0 replace group',
    security: [{ scimToken: [] }],
    responses: {
      200: { description: 'Group' },
      401: { description: 'Invalid SCIM token' },
    },
  },
});

export default defineHandler(async (event) => handleScimGroups(event));
