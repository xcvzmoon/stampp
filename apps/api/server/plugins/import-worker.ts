import { definePlugin } from 'nitro';
import { ENV } from '~/server/utils/env.ts';
import { runImportJob } from '~/server/utils/importService.ts';

export default definePlugin((nitroApp) => {
  if (ENV.APP_ENV === 'test') {
    return;
  }
  nitroApp.hooks.hook('close', async () => {
    // Import jobs run inline for now; BullMQ wiring lands with the ops track.
  });
});

export async function processImportJob(jobId: string, workspaceId: string): Promise<void> {
  await runImportJob(jobId, workspaceId);
}
