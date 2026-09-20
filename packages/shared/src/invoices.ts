import * as v from 'valibot';
import { calendarDateSchema, currencySchema, idSchema } from './schemas.ts';

export const invoiceStatusSchema = v.picklist(['draft', 'sent', 'paid', 'void']);
export const invoiceLineKindSchema = v.picklist(['time', 'expense', 'manual']);

export const invoiceLineInputSchema = v.object({
  kind: invoiceLineKindSchema,
  sourceId: v.optional(v.nullable(idSchema)),
  description: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(0)),
  unitAmountMinor: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const createInvoiceInputSchema = v.object({
  clientId: v.optional(v.nullable(idSchema)),
  projectId: v.optional(v.nullable(idSchema)),
  issueDate: calendarDateSchema,
  dueDate: v.optional(v.nullable(calendarDateSchema)),
  currency: v.pipe(
    currencySchema,
    v.transform((input) => input.toUpperCase()),
  ),
  discountMinor: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  taxRateBps: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000))),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5000)))),
  lines: v.pipe(v.array(invoiceLineInputSchema), v.minLength(1)),
});

export const generateInvoiceInputSchema = v.object({
  clientId: v.optional(v.nullable(idSchema)),
  projectId: v.optional(v.nullable(idSchema)),
  from: calendarDateSchema,
  to: calendarDateSchema,
  issueDate: calendarDateSchema,
  dueDate: v.optional(v.nullable(calendarDateSchema)),
  currency: v.pipe(
    currencySchema,
    v.transform((input) => input.toUpperCase()),
  ),
  includeExpenses: v.optional(v.boolean()),
  taxRateBps: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000))),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5000)))),
});

export const updateInvoiceInputSchema = v.object({
  clientId: v.optional(v.nullable(idSchema)),
  projectId: v.optional(v.nullable(idSchema)),
  issueDate: v.optional(calendarDateSchema),
  dueDate: v.optional(v.nullable(calendarDateSchema)),
  discountMinor: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  taxRateBps: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000))),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5000)))),
});

export const invoiceStatusActionSchema = v.object({
  action: v.picklist(['send', 'pay', 'void']),
});

export const recordPaymentInputSchema = v.object({
  amountMinor: v.pipe(v.number(), v.integer(), v.minValue(1)),
  paidAt: v.optional(v.string()),
  method: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(64))),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2000)))),
});

export const invoiceListQuerySchema = v.object({
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
  status: v.optional(invoiceStatusSchema),
  clientId: v.optional(idSchema),
  projectId: v.optional(idSchema),
});

export const invoiceLineDtoSchema = v.object({
  id: v.string(),
  kind: invoiceLineKindSchema,
  sourceId: v.nullable(v.string()),
  description: v.string(),
  quantity: v.number(),
  unitAmountMinor: v.number(),
  amountMinor: v.number(),
  sortOrder: v.number(),
});

export const invoicePaymentDtoSchema = v.object({
  id: v.string(),
  amountMinor: v.number(),
  paidAt: v.string(),
  method: v.nullable(v.string()),
  notes: v.nullable(v.string()),
});

export const invoiceDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  clientId: v.nullable(v.string()),
  projectId: v.nullable(v.string()),
  number: v.string(),
  status: invoiceStatusSchema,
  issueDate: calendarDateSchema,
  dueDate: v.nullable(calendarDateSchema),
  currency: v.string(),
  subtotalMinor: v.number(),
  discountMinor: v.number(),
  taxRateBps: v.number(),
  taxMinor: v.number(),
  totalMinor: v.number(),
  paidMinor: v.number(),
  balanceMinor: v.number(),
  notes: v.nullable(v.string()),
  lines: v.array(invoiceLineDtoSchema),
  payments: v.array(invoicePaymentDtoSchema),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const invoiceListResultSchema = v.object({
  items: v.array(invoiceDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export type CreateInvoiceInput = v.InferOutput<typeof createInvoiceInputSchema>;
export type GenerateInvoiceInput = v.InferOutput<typeof generateInvoiceInputSchema>;
export type UpdateInvoiceInput = v.InferOutput<typeof updateInvoiceInputSchema>;
export type RecordPaymentInput = v.InferOutput<typeof recordPaymentInputSchema>;
export type InvoiceListQuery = v.InferOutput<typeof invoiceListQuerySchema>;
export type InvoiceDto = v.InferOutput<typeof invoiceDtoSchema>;
export type InvoiceLineDto = v.InferOutput<typeof invoiceLineDtoSchema>;
export type InvoicePaymentDto = v.InferOutput<typeof invoicePaymentDtoSchema>;
export type InvoiceStatus = v.InferOutput<typeof invoiceStatusSchema>;
