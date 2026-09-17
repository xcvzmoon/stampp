import * as v from 'valibot';
import { calendarDateSchema, idSchema, minutesSchema } from './schemas.ts';

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

/** Filters and output settings shared by report endpoints. */
export const reportQuerySchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: timezoneSchema,
  projectId: v.optional(idSchema),
  clientId: v.optional(idSchema),
  userId: v.optional(idSchema),
  billable: v.optional(v.picklist(['true', 'false'])),
  groupBy: v.optional(v.picklist(['project', 'client', 'user'])),
  format: v.optional(v.picklist(['json', 'csv'])),
});

const reportTotalFields = {
  totalMinutes: minutesSchema,
  billableMinutes: minutesSchema,
  nonBillableMinutes: minutesSchema,
};

/** Total, billable, and non-billable minutes. */
export const reportTotalsSchema = v.object(reportTotalFields);

/** One named group in a summary report. */
export const reportGroupSchema = v.object({
  id: v.nullable(v.string()),
  name: v.string(),
  ...reportTotalFields,
});

/** Summary report response grouped by project, client, or user. */
export const summaryReportSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: v.string(),
  groupBy: v.picklist(['project', 'client', 'user']),
  totals: reportTotalsSchema,
  groups: v.array(reportGroupSchema),
});

/** One completed time entry in a detailed report. */
export const detailedReportEntrySchema = v.object({
  id: v.string(),
  date: calendarDateSchema,
  userId: v.string(),
  userName: v.string(),
  clientId: v.nullable(v.string()),
  clientName: v.nullable(v.string()),
  projectId: v.nullable(v.string()),
  projectName: v.nullable(v.string()),
  description: v.string(),
  billable: v.boolean(),
  minutes: minutesSchema,
  startAt: v.nullable(v.string()),
  endAt: v.nullable(v.string()),
});

/** Detailed report response with stable chronological ordering. */
export const detailedReportSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: v.string(),
  totals: reportTotalsSchema,
  entries: v.array(detailedReportEntrySchema),
});

/** One calendar week in a weekly report. */
export const weeklyReportGroupSchema = v.object({
  weekStart: calendarDateSchema,
  weekEnd: calendarDateSchema,
  ...reportTotalFields,
});

/** Weekly report response in ascending week order. */
export const weeklyReportSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timezone: v.string(),
  totals: reportTotalsSchema,
  weeks: v.array(weeklyReportGroupSchema),
});

/** Validated report filters and output options. */
export type ReportQuery = v.InferOutput<typeof reportQuerySchema>;
/** Aggregate report values. */
export type ReportTotals = v.InferOutput<typeof reportTotalsSchema>;
/** Summary report payload. */
export type SummaryReport = v.InferOutput<typeof summaryReportSchema>;
/** Detailed report row. */
export type DetailedReportEntry = v.InferOutput<typeof detailedReportEntrySchema>;
/** Detailed report payload. */
export type DetailedReport = v.InferOutput<typeof detailedReportSchema>;
/** Weekly report payload. */
export type WeeklyReport = v.InferOutput<typeof weeklyReportSchema>;
