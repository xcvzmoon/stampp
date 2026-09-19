import * as v from 'valibot';
import { calendarDateSchema, idSchema, isoDateSchema, minutesSchema } from './schemas.ts';

const descriptionSchema = v.pipe(v.string(), v.trim(), v.maxLength(1000));
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
const optionalAssignmentSchema = {
  projectId: v.optional(v.nullable(idSchema)),
  taskId: v.optional(v.nullable(idSchema)),
};

export const startTimerInputSchema = v.object({
  ...optionalAssignmentSchema,
  description: v.optional(descriptionSchema),
  billable: v.optional(v.boolean()),
  timezone: timezoneSchema,
});

export const addManualTimeInputSchema = v.variant('kind', [
  v.object({
    kind: v.literal('interval'),
    ...optionalAssignmentSchema,
    description: v.optional(descriptionSchema),
    billable: v.optional(v.boolean()),
    startAt: isoDateSchema,
    endAt: isoDateSchema,
    timezone: timezoneSchema,
  }),
  v.object({
    kind: v.literal('duration'),
    ...optionalAssignmentSchema,
    description: v.optional(descriptionSchema),
    billable: v.optional(v.boolean()),
    durationMinutes: v.pipe(minutesSchema, v.minValue(1)),
    workDate: v.optional(calendarDateSchema),
    timezone: timezoneSchema,
  }),
]);

export const updateTimeEntryInputSchema = v.object({
  projectId: v.optional(v.nullable(idSchema)),
  taskId: v.optional(v.nullable(idSchema)),
  description: v.optional(descriptionSchema),
  billable: v.optional(v.boolean()),
  startAt: v.optional(isoDateSchema),
  endAt: v.optional(v.nullable(isoDateSchema)),
  durationMinutes: v.optional(v.nullable(v.pipe(minutesSchema, v.minValue(1)))),
  workDate: v.optional(calendarDateSchema),
  timezone: v.optional(timezoneSchema),
});

export const timeEntryListQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer(),
      v.minValue(1),
      v.maxValue(200),
    ),
  ),
  cursor: v.optional(idSchema),
  from: v.optional(isoDateSchema),
  to: v.optional(isoDateSchema),
  projectId: v.optional(idSchema),
});

export const timeEntryDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  projectId: v.nullable(v.string()),
  taskId: v.nullable(v.string()),
  description: v.string(),
  billable: v.boolean(),
  startAt: v.nullable(v.string()),
  endAt: v.nullable(v.string()),
  durationMinutes: v.nullable(v.number()),
  workDate: calendarDateSchema,
  timezone: v.string(),
  lockedAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const timeEntryListResultSchema = v.object({
  items: v.array(timeEntryDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const weeklyTimeQuerySchema = v.object({
  weekStart: calendarDateSchema,
  timezone: timezoneSchema,
});

export const weeklyTimeDaySchema = v.object({
  date: calendarDateSchema,
  totalMinutes: minutesSchema,
  expectedMinutes: minutesSchema,
  missingMinutes: minutesSchema,
});

export const weeklyTimeProjectSchema = v.object({
  projectId: v.nullable(v.string()),
  entries: v.array(timeEntryDtoSchema),
  dailyMinutes: v.array(minutesSchema),
  totalMinutes: minutesSchema,
});

export const weeklyTimeSummarySchema = v.object({
  weekStart: calendarDateSchema,
  weekEnd: calendarDateSchema,
  timezone: v.string(),
  days: v.array(weeklyTimeDaySchema),
  projects: v.array(weeklyTimeProjectSchema),
  totalMinutes: minutesSchema,
  expectedMinutes: minutesSchema,
  missingMinutes: minutesSchema,
});

export const copyPreviousWeekInputSchema = v.object({
  weekStart: calendarDateSchema,
  timezone: timezoneSchema,
});

export const copyPreviousWeekResultSchema = v.object({
  copiedEntries: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type StartTimerInput = v.InferOutput<typeof startTimerInputSchema>;
export type AddManualTimeInput = v.InferOutput<typeof addManualTimeInputSchema>;
export type UpdateTimeEntryInput = v.InferOutput<typeof updateTimeEntryInputSchema>;
export type TimeEntryListQuery = v.InferOutput<typeof timeEntryListQuerySchema>;
export type TimeEntryDto = v.InferOutput<typeof timeEntryDtoSchema>;
export type WeeklyTimeQuery = v.InferOutput<typeof weeklyTimeQuerySchema>;
export type WeeklyTimeSummary = v.InferOutput<typeof weeklyTimeSummarySchema>;
export type CopyPreviousWeekInput = v.InferOutput<typeof copyPreviousWeekInputSchema>;
