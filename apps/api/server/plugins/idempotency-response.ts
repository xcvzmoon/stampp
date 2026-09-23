import { definePlugin } from 'nitro';
import { storeIdempotentResponse } from '~/server/middleware/v1-platform.ts';

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('response', async (res, event) => {
    await storeIdempotentResponse(event, res);
  });
});
