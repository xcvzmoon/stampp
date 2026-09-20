import * as v from 'valibot';
import { currencySchema, idSchema, isoDateSchema } from './schemas.ts';

export const rateKindSchema = v.picklist(['billable', 'cost']);
export const rateScopeSchema = v.picklist(['org', 'user', 'project', 'user_project', 'task']);

export type RateKind = v.InferOutput<typeof rateKindSchema>;
export type RateScope = v.InferOutput<typeof rateScopeSchema>;

export const amountMinorSchema = v.pipe(
  v.number(),
  v.integer('Amount must be integer minor units'),
  v.minValue(0),
  v.maxValue(1_000_000_000_000),
);

export const createRateInputSchema = v.object({
  kind: rateKindSchema,
  scope: rateScopeSchema,
  userId: v.optional(v.nullable(idSchema)),
  projectId: v.optional(v.nullable(idSchema)),
  taskId: v.optional(v.nullable(idSchema)),
  amountMinor: amountMinorSchema,
  currency: v.pipe(
    currencySchema,
    v.transform((input) => input.toUpperCase()),
  ),
  effectiveFrom: isoDateSchema,
});

export const rateListQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer('limit must be an integer'),
      v.minValue(1),
      v.maxValue(200),
    ),
  ),
  cursor: v.optional(v.pipe(v.string(), v.maxLength(128))),
  kind: v.optional(rateKindSchema),
  scope: v.optional(rateScopeSchema),
  projectId: v.optional(idSchema),
  userId: v.optional(idSchema),
});

export const resolveRatesQuerySchema = v.object({
  at: v.optional(isoDateSchema),
  userId: v.optional(idSchema),
  projectId: v.optional(idSchema),
  taskId: v.optional(idSchema),
});

export const rateDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  kind: rateKindSchema,
  scope: rateScopeSchema,
  userId: v.nullable(v.string()),
  projectId: v.nullable(v.string()),
  taskId: v.nullable(v.string()),
  amountMinor: v.number(),
  currency: v.string(),
  effectiveFrom: v.string(),
  effectiveTo: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const effectiveRatesDtoSchema = v.object({
  billable: v.nullable(
    v.object({
      amountMinor: v.number(),
      currency: v.string(),
    }),
  ),
  cost: v.nullable(
    v.object({
      amountMinor: v.number(),
      currency: v.string(),
    }),
  ),
  currency: v.string(),
  source: v.picklist(['task', 'project', 'user_project', 'user', 'org', 'none']),
  at: v.string(),
  userId: v.nullable(v.string()),
  projectId: v.nullable(v.string()),
  taskId: v.nullable(v.string()),
});

export type CreateRateInput = v.InferOutput<typeof createRateInputSchema>;
export type RateListQuery = v.InferOutput<typeof rateListQuerySchema>;
export type ResolveRatesQuery = v.InferOutput<typeof resolveRatesQuerySchema>;
export type RateDto = v.InferOutput<typeof rateDtoSchema>;
export type EffectiveRatesDto = v.InferOutput<typeof effectiveRatesDtoSchema>;
