import { createAuthMiddleware } from 'evlog/better-auth';
import { useLogger } from 'evlog/nitro/v3';
import { definePlugin } from 'nitro';
import { getAuth } from '~/server/utils/auth.ts';

const identify = createAuthMiddleware(getAuth(), {
  exclude: ['/api/auth/**'],
});

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    const log = useLogger(event);
    const path = new URL(event.req.url).pathname;
    await identify(log, event.req.headers, path);
  });
});
