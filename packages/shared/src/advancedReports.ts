import * as v from 'valibot';
import { calendarDateSchema } from './schemas.ts';

const timezoneSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(100),
  v.check((input) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: input }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Must be a valid IANA timezone'),
);

export const profitabilityQuerySchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: timezoneSchema,
  projectId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  groupBy: v.optional(v.picklist(['project', 'user'])),
  format: v.optional(v.picklist(['json', 'csv'])),
});

export const utilizationQuerySchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: timezoneSchema,
  projectId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  userId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  groupBy: v.optional(v.picklist(['user', 'project'])),
  format: v.optional(v.picklist(['json', 'csv'])),
});

export const marginTotalsSchema = v.object({
  revenueMinor: v.number(),
  laborCostMinor: v.number(),
  expenseMinor: v.number(),
  profitMinor: v.number(),
  marginRatio: v.nullable(v.number()),
});

export const profitabilityGroupSchema = v.object({
  id: v.nullable(v.string()),
  name: v.string(),
  revenueMinor: v.number(),
  laborCostMinor: v.number(),
  expenseMinor: v.number(),
  profitMinor: v.number(),
  marginRatio: v.nullable(v.number()),
  totalMinutes: v.number(),
  billableMinutes: v.number(),
});

export const profitabilityReportSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: v.string(),
  groupBy: v.picklist(['project', 'user']),
  currency: v.string(),
  totals: marginTotalsSchema,
  groups: v.array(profitabilityGroupSchema),
});

export const utilizationGroupSchema = v.object({
  id: v.nullable(v.string()),
  name: v.string(),
  totalMinutes: v.number(),
  billableMinutes: v.number(),
  nonBillableMinutes: v.number(),
  utilizationRatio: v.nullable(v.number()),
});

export const utilizationReportSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: v.string(),
  groupBy: v.picklist(['user', 'project']),
  totals: v.object({
    totalMinutes: v.number(),
    billableMinutes: v.number(),
    nonBillableMinutes: v.number(),
    utilizationRatio: v.nullable(v.number()),
  }),
  groups: v.array(utilizationGroupSchema),
});

export type ProfitabilityQuery = v.InferOutput<typeof profitabilityQuerySchema>;
export type UtilizationQuery = v.InferOutput<typeof utilizationQuerySchema>;
export type MarginTotalsDto = v.InferOutput<typeof marginTotalsSchema>;
export type ProfitabilityGroupDto = v.InferOutput<typeof profitabilityGroupSchema>;
export type ProfitabilityReport = v.InferOutput<typeof profitabilityReportSchema>;
export type UtilizationGroupDto = v.InferOutput<typeof utilizationGroupSchema>;
export type UtilizationReport = v.InferOutput<typeof utilizationReportSchema>;
