import * as v from 'valibot';
import { idSchema } from './schemas.ts';

export const budgetAlertLevelSchema = v.picklist(['none', 'warning', 'exceeded']);

export const projectBudgetUsageSchema = v.object({
  projectId: idSchema,
  projectName: v.string(),
  usedMinutes: v.number(),
  budgetMinutes: v.nullable(v.number()),
  usedAmountMinor: v.number(),
  budgetAmountMinor: v.nullable(v.number()),
  currency: v.nullable(v.string()),
  alertAtPercent: v.number(),
  hoursLevel: budgetAlertLevelSchema,
  moneyLevel: budgetAlertLevelSchema,
  hoursRatio: v.nullable(v.number()),
  moneyRatio: v.nullable(v.number()),
});

export const projectBudgetUsageListSchema = v.object({
  items: v.array(projectBudgetUsageSchema),
});

export type BudgetAlertLevel = v.InferOutput<typeof budgetAlertLevelSchema>;
export type ProjectBudgetUsage = v.InferOutput<typeof projectBudgetUsageSchema>;
