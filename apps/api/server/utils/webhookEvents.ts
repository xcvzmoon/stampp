import type { AuthorizedContext } from '@stampp/access';
import type { WebhookEventType } from '@stampp/domain';
import { v7 as uuidv7 } from 'uuid';
import { getWebhookQueue } from '~/server/utils/webhookRuntime.ts';
import {
  enqueueMatchingWebhookDeliveries,
  type WebhookDeliveryJob,
  type WebhookEventPayload,
} from '~/server/utils/webhooks.ts';

/**
 * Fire-and-forget product events. Call sites never wait on remote delivery;
 * failures land in `webhook_deliveries` for retry/dead-letter handling.
 */
export async function emitWebhookEvent(
  ctx: AuthorizedContext,
  event: WebhookEventType,
  data: WebhookEventPayload,
): Promise<void> {
  try {
    const queue = getWebhookQueue();
    await enqueueMatchingWebhookDeliveries(
      ctx,
      event,
      uuidv7(),
      data,
      async (job: WebhookDeliveryJob) => {
        await queue.enqueue(job);
      },
    );
  } catch (error) {
    console.error('[webhooks] enqueue failed for %s: %s', event, error);
  }
}
