import type { Worker } from 'bullmq';
import { createValkeyConnection } from '@stampp/mailer';
import { ENV } from '~/server/utils/env.ts';
import {
  createWebhookQueue,
  createWebhookWorker,
  type WebhookQueue,
} from '~/server/utils/webhookQueue.ts';

let queue: WebhookQueue | undefined;
let worker: Worker | undefined;
let connection: ReturnType<typeof createValkeyConnection> | undefined;

export function getWebhookQueue(): WebhookQueue {
  if (!queue) {
    connection = createValkeyConnection(ENV.VALKEY_URL);
    queue = createWebhookQueue(connection);
  }
  return queue;
}

export function startWebhookWorker(): Worker {
  if (!worker) {
    connection = connection ?? createValkeyConnection(ENV.VALKEY_URL);
    worker = createWebhookWorker(connection);
  }
  return worker;
}

export async function closeWebhookRuntime(): Promise<void> {
  const currentWorker = worker;
  const currentQueue = queue;
  const currentConnection = connection;
  worker = undefined;
  queue = undefined;
  connection = undefined;
  if (currentWorker) {
    await currentWorker.close();
  }
  if (currentQueue) {
    await currentQueue.close();
  }
  if (currentConnection) {
    await currentConnection.quit().catch(() => {
      currentConnection.disconnect();
    });
  }
}
