import { defineHandler, defineRouteMeta } from 'nitro';
import { handleScimGroups } from '~/server/utils/scimService.ts';

defineRouteMeta({
  openAPI: {
    tags: ['scim'],
    summary: 'SCIM 2.0 create/replace group members',
    security: [{ scimToken: [] }],
    responses: {
      201: { description: 'Group' },
      401: { description: 'Invalid SCIM token' },
    },
  },
});

export default defineHandler(async (event) => handleScimGroups(event));
