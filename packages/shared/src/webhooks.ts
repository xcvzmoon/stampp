import type { WebhookEventType } from '@stampp/domain';
import { isValidWebhookUrl, WEBHOOK_EVENT_TYPES } from '@stampp/domain';
import * as v from 'valibot';
import { idSchema } from './schemas.ts';

export { WEBHOOK_EVENT_TYPES };
export type { WebhookEventType };

export const webhookEventTypeSchema = v.picklist(WEBHOOK_EVENT_TYPES);

export const webhookUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((input) => isValidWebhookUrl(input), 'Webhook URL must be https (or localhost http)'),
);

export const createWebhookSubscriptionInputSchema = v.object({
  url: webhookUrlSchema,
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
  events: v.pipe(v.array(webhookEventTypeSchema), v.minLength(1)),
});

export const updateWebhookSubscriptionInputSchema = v.object({
  url: v.optional(webhookUrlSchema),
  description: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
  events: v.optional(v.pipe(v.array(webhookEventTypeSchema), v.minLength(1))),
  status: v.optional(v.picklist(['active', 'disabled'])),
});

export const webhookListQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer('limit must be an integer'),
      v.minValue(1),
      v.maxValue(200),
    ),
  ),
  cursor: v.optional(idSchema),
  status: v.optional(v.picklist(['active', 'disabled'])),
});

export const webhookDeliveryListQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer('limit must be an integer'),
      v.minValue(1),
      v.maxValue(200),
    ),
  ),
  cursor: v.optional(idSchema),
  status: v.optional(v.picklist(['pending', 'success', 'failed', 'dead'])),
  event: v.optional(webhookEventTypeSchema),
});

export const webhookSubscriptionDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  url: v.string(),
  description: v.nullable(v.string()),
  events: v.array(webhookEventTypeSchema),
  status: v.picklist(['active', 'disabled']),
  secretPrefix: v.string(),
  lastDeliveryAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

/** Full secret is returned only at create and rotate. */
export const webhookSubscriptionCreatedSchema = v.object({
  secret: v.string(),
  subscription: webhookSubscriptionDtoSchema,
});

export const webhookSubscriptionListResultSchema = v.object({
  items: v.array(webhookSubscriptionDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const webhookDeliveryDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  webhookId: v.string(),
  event: webhookEventTypeSchema,
  eventId: v.string(),
  status: v.picklist(['pending', 'success', 'failed', 'dead']),
  attemptCount: v.number(),
  lastStatusCode: v.nullable(v.number()),
  lastError: v.nullable(v.string()),
  nextAttemptAt: v.nullable(v.string()),
  createdAt: v.string(),
  completedAt: v.nullable(v.string()),
});

export const webhookDeliveryListResultSchema = v.object({
  items: v.array(webhookDeliveryDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const webhookTestInputSchema = v.object({
  event: v.optional(webhookEventTypeSchema),
});

export type CreateWebhookSubscriptionInput = v.InferOutput<
  typeof createWebhookSubscriptionInputSchema
>;
export type UpdateWebhookSubscriptionInput = v.InferOutput<
  typeof updateWebhookSubscriptionInputSchema
>;
export type WebhookSubscriptionDto = v.InferOutput<typeof webhookSubscriptionDtoSchema>;
export type WebhookSubscriptionCreated = v.InferOutput<typeof webhookSubscriptionCreatedSchema>;
export type WebhookDeliveryDto = v.InferOutput<typeof webhookDeliveryDtoSchema>;
export type WebhookListQuery = v.InferOutput<typeof webhookListQuerySchema>;
export type WebhookDeliveryListQuery = v.InferOutput<typeof webhookDeliveryListQuerySchema>;
export type WebhookTestInput = v.InferOutput<typeof webhookTestInputSchema>;
