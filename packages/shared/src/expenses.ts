import * as v from 'valibot';
import { calendarDateSchema, currencySchema, idSchema } from './schemas.ts';

export const expenseCategorySchema = v.picklist([
  'travel',
  'meals',
  'lodging',
  'software',
  'equipment',
  'other',
]);

export const expenseStatusSchema = v.picklist(['open', 'approved', 'rejected']);

export const expenseAmountMinorSchema = v.pipe(
  v.number(),
  v.integer('Amount must be integer minor units'),
  v.minValue(1),
  v.maxValue(1_000_000_000_000),
);

export const createExpenseInputSchema = v.object({
  projectId: v.optional(v.nullable(idSchema)),
  expenseDate: calendarDateSchema,
  amountMinor: expenseAmountMinorSchema,
  currency: v.pipe(
    currencySchema,
    v.transform((input) => input.toUpperCase()),
  ),
  category: expenseCategorySchema,
  description: v.pipe(v.string(), v.trim(), v.maxLength(500)),
  notes: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(5000))),
  billable: v.optional(v.boolean()),
});

export const updateExpenseInputSchema = v.object({
  projectId: v.optional(v.nullable(idSchema)),
  expenseDate: v.optional(calendarDateSchema),
  amountMinor: v.optional(expenseAmountMinorSchema),
  currency: v.optional(
    v.pipe(
      currencySchema,
      v.transform((input) => input.toUpperCase()),
    ),
  ),
  category: v.optional(expenseCategorySchema),
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5000)))),
  billable: v.optional(v.boolean()),
  status: v.optional(expenseStatusSchema),
});

export const expenseListQuerySchema = v.object({
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
  projectId: v.optional(idSchema),
  userId: v.optional(idSchema),
  category: v.optional(expenseCategorySchema),
  status: v.optional(expenseStatusSchema),
  from: v.optional(calendarDateSchema),
  to: v.optional(calendarDateSchema),
});

export const expenseDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  projectId: v.nullable(v.string()),
  expenseDate: calendarDateSchema,
  amountMinor: v.number(),
  currency: v.string(),
  category: expenseCategorySchema,
  description: v.string(),
  notes: v.nullable(v.string()),
  billable: v.boolean(),
  status: expenseStatusSchema,
  receiptFilename: v.nullable(v.string()),
  receiptContentType: v.nullable(v.string()),
  receiptSizeBytes: v.nullable(v.number()),
  hasReceipt: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const expenseListResultSchema = v.object({
  items: v.array(expenseDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export type CreateExpenseInput = v.InferOutput<typeof createExpenseInputSchema>;
export type UpdateExpenseInput = v.InferOutput<typeof updateExpenseInputSchema>;
export type ExpenseListQuery = v.InferOutput<typeof expenseListQuerySchema>;
export type ExpenseDto = v.InferOutput<typeof expenseDtoSchema>;
export type ExpenseCategory = v.InferOutput<typeof expenseCategorySchema>;
export type ExpenseStatus = v.InferOutput<typeof expenseStatusSchema>;
