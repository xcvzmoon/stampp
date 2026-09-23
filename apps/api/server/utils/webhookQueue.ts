import type { JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { WebhookDeliveryJob } from '~/server/utils/webhooks.ts';
import { webhookDeliveries, webhookSubscriptions } from '@stampp/database';
import {
  shouldRetryWebhookDelivery,
  webhookBackoffMs,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '@stampp/domain';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '~/server/utils/db.ts';

export const WEBHOOK_QUEUE_NAME = 'webhooks';
export const WEBHOOK_JOB_NAME = 'deliver';

export const webhookJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'custom',
  },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400, count: 500 },
};

export type WebhookQueue = {
  enqueue: (job: WebhookDeliveryJob) => Promise<void>;
  close: () => Promise<void>;
};

export function createWebhookQueue(connection: Redis): WebhookQueue {
  const queue = new Queue<WebhookDeliveryJob>(WEBHOOK_QUEUE_NAME, {
    connection,
    defaultJobOptions: webhookJobOptions,
  });

  return {
    async enqueue(job) {
      await queue.add(WEBHOOK_JOB_NAME, job, {
        jobId: job.deliveryId,
        attempts: 5,
        backoff: {
          type: 'custom',
        },
      });
    },
    async close() {
      await queue.close();
    },
  };
}

export async function deliverWebhookJob(job: WebhookDeliveryJob): Promise<void> {
  const db = getDb();
  const response = await fetch(job.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Stampp-Webhooks/1.0',
      [WEBHOOK_SIGNATURE_HEADER]: job.signature,
      [WEBHOOK_EVENT_HEADER]: job.event,
      [WEBHOOK_DELIVERY_HEADER]: job.deliveryId,
      [WEBHOOK_TIMESTAMP_HEADER]: String(job.timestamp),
    },
    body: job.rawBody,
    signal: AbortSignal.timeout(10_000),
  });

  const rows = await db
    .select({ attemptCount: webhookDeliveries.attemptCount })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, job.deliveryId))
    .limit(1);
  const previousAttempts = rows[0]?.attemptCount ?? 0;
  const nextAttempts = previousAttempts + 1;
  const success = response.ok;
  const retry = shouldRetryWebhookDelivery(nextAttempts, response.status);

  await db
    .update(webhookDeliveries)
    .set({
      attemptCount: nextAttempts,
      lastStatusCode: response.status,
      lastError: success ? null : await readErrorSnippet(response),
      status: success ? 'success' : retry ? 'failed' : 'dead',
      nextAttemptAt: retry ? new Date(Date.now() + webhookBackoffMs(nextAttempts)) : null,
      completedAt: success || !retry ? new Date() : null,
    })
    .where(eq(webhookDeliveries.id, job.deliveryId));

  await db
    .update(webhookSubscriptions)
    .set({ lastDeliveryAt: new Date() })
    .where(and(eq(webhookSubscriptions.id, job.webhookId), isNull(webhookSubscriptions.deletedAt)));

  if (!success && !retry) {
    throw new UnrecoverableError(
      `webhook.delivery.dead status=${response.status} delivery=${job.deliveryId}`,
    );
  }
  if (!success) {
    throw new Error(`webhook.delivery.failed status=${response.status} delivery=${job.deliveryId}`);
  }
}

async function readErrorSnippet(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return `HTTP ${response.status}`;
  }
}

export function createWebhookWorker(connection: Redis): Worker<WebhookDeliveryJob> {
  return new Worker<WebhookDeliveryJob>(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      await deliverWebhookJob(job.data);
    },
    {
      connection,
      concurrency: 5,
    },
  );
}
