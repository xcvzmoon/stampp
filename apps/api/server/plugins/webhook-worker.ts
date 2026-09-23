import { definePlugin } from 'nitro';
import { ENV } from '~/server/utils/env.ts';
import { closeWebhookRuntime, startWebhookWorker } from '~/server/utils/webhookRuntime.ts';

export default definePlugin((nitroApp) => {
  if (ENV.APP_ENV === 'test') {
    return;
  }

  const worker = startWebhookWorker();
  worker.on('failed', (job, error) => {
    console.error('[webhooks] job %s failed: %s', job?.id, error.message);
  });

  nitroApp.hooks.hook('close', async () => {
    await closeWebhookRuntime();
  });
});
