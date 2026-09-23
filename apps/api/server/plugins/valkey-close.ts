import { definePlugin } from 'nitro';
import { ENV } from '~/server/utils/env.ts';
import { closeValkey } from '~/server/utils/valkey.ts';

export default definePlugin((nitroApp) => {
  if (ENV.APP_ENV === 'test') {
    return;
  }

  nitroApp.hooks.hook('close', async () => {
    await closeValkey();
  });
});
