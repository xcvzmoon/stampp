import { defineHandler, defineRouteMeta } from 'nitro';
import { getAuth } from '~/server/utils/auth.ts';

defineRouteMeta({
  openAPI: {
    tags: ['auth'],
    summary: 'Better Auth handler',
    description:
      'Catch-all for Better Auth (sign-in, sign-up, session, organization, invitations). Not covered by the product OpenAPI DTOs.',
    responses: {
      200: { description: 'Better Auth response' },
      400: { description: 'Better Auth validation error' },
      401: { description: 'Unauthenticated' },
    },
  },
});

export default defineHandler((event) => {
  return getAuth().handler(event.req);
});
