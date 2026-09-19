import { definePlugin } from 'nitro';
import { ENV } from '~/server/utils/env.ts';
import { getEmailRuntime } from '~/server/utils/mailer.ts';

export default definePlugin((nitroApp) => {
  if (ENV.APP_ENV === 'test') {
    return;
  }

  const { worker, close } = getEmailRuntime();

  if (worker) {
    worker.on('failed', (job, error) => {
      console.error('[email] job %s failed: %s', job?.id, error.message);
    });
  }

  nitroApp.hooks.hook('close', async () => {
    await close();
  });
});
