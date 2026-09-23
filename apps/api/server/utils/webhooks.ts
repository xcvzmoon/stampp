import type { AuthorizedContext } from '@stampp/access';
import type { WebhookDelivery, WebhookSubscription } from '@stampp/database';
import type { WebhookEventType } from '@stampp/domain';
import type {
  JsonValue,
  WebhookDeliveryDto,
  WebhookSubscriptionCreated,
  WebhookSubscriptionDto,
  WebhookTestInput,
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
} from '@stampp/shared';
import { webhookDeliveries, webhookSubscriptions } from '@stampp/database';
import {
  formatWebhookSignature,
  isValidWebhookUrl,
  webhookSignedPayload,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '@stampp/domain';
import { DEFAULT_LIST_LIMIT, ERROR_CODES } from '@stampp/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createHmac, randomBytes } from 'node:crypto';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';

export type GeneratedWebhookSecret = {
  secret: string;
  secretPrefix: string;
};

export type WebhookDeliveryJob = {
  deliveryId: string;
  webhookId: string;
  workspaceId: string;
  url: string;
  secret: string;
  event: WebhookEventType;
  eventId: string;
  rawBody: string;
  timestamp: number;
  signature: string;
};

export function generateWebhookSecret(): GeneratedWebhookSecret {
  const secret = `whsec_${randomBytes(32).toString('base64url')}`;
  return { secret, secretPrefix: secret.slice(0, 12) };
}

export function signWebhookBody(secret: string, timestamp: number, rawBody: string): string {
  const digest = createHmac('sha256', secret)
    .update(webhookSignedPayload(timestamp, rawBody))
    .digest('hex');
  return formatWebhookSignature(timestamp, digest);
}

export type WebhookEventPayload = Record<string, JsonValue>;

export type WebhookEnvelope = {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  workspaceId: string;
  data: WebhookEventPayload;
};

export function buildWebhookEnvelope(
  event: WebhookEventType,
  eventId: string,
  workspaceId: string,
  data: WebhookEventPayload,
): WebhookEnvelope {
  return {
    id: eventId,
    type: event,
    createdAt: new Date().toISOString(),
    workspaceId,
    data,
  };
}

export function toWebhookSubscriptionDto(row: WebhookSubscription): WebhookSubscriptionDto {
  // SAFETY: events are validated on write through webhookEventTypeSchema.
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    url: row.url,
    description: row.description,
    events: row.events as WebhookSubscriptionDto['events'],
    status: row.status,
    secretPrefix: row.secretPrefix,
    lastDeliveryAt: row.lastDeliveryAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWebhookDeliveryDto(row: WebhookDelivery): WebhookDeliveryDto {
  // SAFETY: delivery.event is written only from the WebhookEventType catalog.
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    webhookId: row.webhookId,
    event: row.event as WebhookEventType,
    eventId: row.eventId,
    status: row.status,
    attemptCount: row.attemptCount,
    lastStatusCode: row.lastStatusCode,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function invalidUrl(requestId: string, message: string) {
  return toApiError(ERROR_CODES.WEBHOOK_INVALID_URL, message, requestId);
}

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Webhook subscription not found', requestId);
}

export async function listWebhookSubscriptions(
  ctx: AuthorizedContext,
  options: {
    limit: number;
    cursor?: string | undefined;
    status?: 'active' | 'disabled' | undefined;
  },
): Promise<{ items: WebhookSubscriptionDto[]; nextCursor: string | null }> {
  const conditions = [eq(webhookSubscriptions.workspaceId, ctx.workspaceId)];
  if (options.cursor) {
    conditions.push(gt(webhookSubscriptions.id, options.cursor));
  }
  if (options.status) {
    conditions.push(eq(webhookSubscriptions.status, options.status));
  }

  const rows = await ctx.db.client
    .select()
    .from(webhookSubscriptions)
    .where(and(...conditions))
    .orderBy(webhookSubscriptions.id)
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toWebhookSubscriptionDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function createWebhookSubscription(
  ctx: AuthorizedContext,
  input: CreateWebhookSubscriptionInput,
  requestId: string,
): Promise<WebhookSubscriptionCreated> {
  if (!isValidWebhookUrl(input.url)) {
    throw invalidUrl(requestId, 'Webhook URL must be https (or localhost http)');
  }

  const generated = generateWebhookSecret();
  const inserted = await ctx.db.client
    .insert(webhookSubscriptions)
    .values({
      workspaceId: ctx.workspaceId,
      url: input.url,
      description: input.description ?? null,
      events: input.events,
      status: 'active',
      secretPrefix: generated.secretPrefix,
      secret: generated.secret,
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create webhook subscription', requestId);
  }

  await recordAudit(ctx, requestId, {
    action: 'webhook.created',
    entityType: 'webhook_subscription',
    entityId: row.id,
    after: { ...row, secret: undefined },
  });

  return {
    secret: generated.secret,
    subscription: toWebhookSubscriptionDto(row),
  };
}

export async function getWebhookSubscriptionRow(
  ctx: AuthorizedContext,
  webhookId: string,
  requestId: string,
): Promise<WebhookSubscription> {
  const rows = await ctx.db.client
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.workspaceId, ctx.workspaceId),
        eq(webhookSubscriptions.id, webhookId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

export async function updateWebhookSubscription(
  ctx: AuthorizedContext,
  webhookId: string,
  input: UpdateWebhookSubscriptionInput,
  requestId: string,
): Promise<WebhookSubscriptionDto> {
  const before = await getWebhookSubscriptionRow(ctx, webhookId, requestId);
  if (input.url !== undefined && !isValidWebhookUrl(input.url)) {
    throw invalidUrl(requestId, 'Webhook URL must be https (or localhost http)');
  }

  const updated = await ctx.db.client
    .update(webhookSubscriptions)
    .set({
      url: input.url ?? before.url,
      description: input.description === undefined ? before.description : input.description,
      events: input.events ?? before.events,
      status: input.status ?? before.status,
    })
    .where(
      and(
        eq(webhookSubscriptions.workspaceId, ctx.workspaceId),
        eq(webhookSubscriptions.id, webhookId),
      ),
    )
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);

  await recordAudit(ctx, requestId, {
    action: 'webhook.updated',
    entityType: 'webhook_subscription',
    entityId: webhookId,
    before: { ...before, secret: undefined },
    after: { ...row, secret: undefined },
  });
  return toWebhookSubscriptionDto(row);
}

export async function deleteWebhookSubscription(
  ctx: AuthorizedContext,
  webhookId: string,
  requestId: string,
): Promise<void> {
  const before = await getWebhookSubscriptionRow(ctx, webhookId, requestId);
  await ctx.db.client
    .delete(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.workspaceId, ctx.workspaceId),
        eq(webhookSubscriptions.id, webhookId),
      ),
    );
  await recordAudit(ctx, requestId, {
    action: 'webhook.deleted',
    entityType: 'webhook_subscription',
    entityId: webhookId,
    before: { ...before, secret: undefined },
  });
}

export async function rotateWebhookSecret(
  ctx: AuthorizedContext,
  webhookId: string,
  requestId: string,
): Promise<WebhookSubscriptionCreated> {
  const before = await getWebhookSubscriptionRow(ctx, webhookId, requestId);
  const generated = generateWebhookSecret();
  const updated = await ctx.db.client
    .update(webhookSubscriptions)
    .set({ secret: generated.secret, secretPrefix: generated.secretPrefix })
    .where(
      and(
        eq(webhookSubscriptions.workspaceId, ctx.workspaceId),
        eq(webhookSubscriptions.id, webhookId),
      ),
    )
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);

  await recordAudit(ctx, requestId, {
    action: 'webhook.secret_rotated',
    entityType: 'webhook_subscription',
    entityId: webhookId,
    before: { secretPrefix: before.secretPrefix },
    after: { secretPrefix: row.secretPrefix },
  });

  return {
    secret: generated.secret,
    subscription: toWebhookSubscriptionDto(row),
  };
}

export async function listWebhookDeliveries(
  ctx: AuthorizedContext,
  webhookId: string,
  options: {
    limit: number;
    cursor?: string | undefined;
    status?: WebhookDelivery['status'] | undefined;
    event?: WebhookEventType | undefined;
  },
  requestId: string,
): Promise<{ items: WebhookDeliveryDto[]; nextCursor: string | null }> {
  await getWebhookSubscriptionRow(ctx, webhookId, requestId);
  const conditions = [
    eq(webhookDeliveries.workspaceId, ctx.workspaceId),
    eq(webhookDeliveries.webhookId, webhookId),
  ];
  if (options.cursor) {
    conditions.push(gt(webhookDeliveries.id, options.cursor));
  }
  if (options.status) {
    conditions.push(eq(webhookDeliveries.status, options.status));
  }
  if (options.event) {
    conditions.push(eq(webhookDeliveries.event, options.event));
  }

  const rows = await ctx.db.client
    .select()
    .from(webhookDeliveries)
    .where(and(...conditions))
    .orderBy(webhookDeliveries.id)
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toWebhookDeliveryDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function enqueueMatchingWebhookDeliveries(
  ctx: AuthorizedContext,
  event: WebhookEventType,
  eventId: string,
  data: WebhookEventPayload,
  enqueue: (job: WebhookDeliveryJob) => Promise<void>,
): Promise<void> {
  const subscriptions = await ctx.db.client
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.workspaceId, ctx.workspaceId),
        eq(webhookSubscriptions.status, 'active'),
        isNull(webhookSubscriptions.deletedAt),
      ),
    );

  const envelope = buildWebhookEnvelope(event, eventId, ctx.workspaceId, data);
  const rawBody = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000);
  const jobs: WebhookDeliveryJob[] = [];

  for (const subscription of subscriptions) {
    if (!subscription.events.includes(event)) {
      continue;
    }
    const inserted = await ctx.db.client
      .insert(webhookDeliveries)
      .values({
        workspaceId: ctx.workspaceId,
        webhookId: subscription.id,
        event,
        eventId,
        payload: envelope,
        status: 'pending',
        attemptCount: 0,
      })
      .returning();
    const delivery = inserted[0];
    if (!delivery) {
      continue;
    }
    jobs.push({
      deliveryId: delivery.id,
      webhookId: subscription.id,
      workspaceId: ctx.workspaceId,
      url: subscription.url,
      secret: subscription.secret,
      event,
      eventId,
      rawBody,
      timestamp,
      signature: signWebhookBody(subscription.secret, timestamp, rawBody),
    });
  }

  await Promise.all(jobs.map((job) => enqueue(job)));
}

export async function createWebhookTestDelivery(
  ctx: AuthorizedContext,
  webhookId: string,
  input: WebhookTestInput,
  requestId: string,
): Promise<WebhookDeliveryDto> {
  const subscription = await getWebhookSubscriptionRow(ctx, webhookId, requestId);
  const event = input.event ?? 'time_entry.created';
  const eventId = `evt_test_${randomBytes(8).toString('hex')}`;
  const envelope = buildWebhookEnvelope(event, eventId, ctx.workspaceId, {
    test: true,
    message: 'Stampp webhook test delivery',
  });
  const inserted = await ctx.db.client
    .insert(webhookDeliveries)
    .values({
      workspaceId: ctx.workspaceId,
      webhookId: subscription.id,
      event,
      eventId,
      payload: envelope,
      status: 'pending',
      attemptCount: 0,
    })
    .returning();
  const delivery = inserted[0];
  if (!delivery) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to queue webhook test', requestId);
  }
  return toWebhookDeliveryDto(delivery);
}

export const webhookHeaders = {
  signature: WEBHOOK_SIGNATURE_HEADER,
  event: WEBHOOK_EVENT_HEADER,
  delivery: WEBHOOK_DELIVERY_HEADER,
  timestamp: WEBHOOK_TIMESTAMP_HEADER,
} as const;

export const DEFAULT_WEBHOOK_LIST_LIMIT = DEFAULT_LIST_LIMIT;
