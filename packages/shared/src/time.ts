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

/** Validates the assignment, description, billing choice, and timezone captured at timer start. */
export const startTimerInputSchema = v.object({
  ...optionalAssignmentSchema,
  description: v.optional(descriptionSchema),
  billable: v.optional(v.boolean()),
  timezone: timezoneSchema,
});

/** Validates manual entries as either a closed interval or a positive whole-minute duration. */
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

/** Validates a partial update; the TimeTracking module verifies the resulting entry shape. */
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

/** Validates cursor pagination and optional date and project filters for time-entry history. */
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

/** Runtime contract for time entries returned by the API. */
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

/** Runtime contract for a cursor-paginated page of time entries. */
export const timeEntryListResultSchema = v.object({
  items: v.array(timeEntryDtoSchema),
  nextCursor: v.nullable(v.string()),
});

/** Validates the Monday and IANA timezone that identify a user's weekly timesheet. */
export const weeklyTimeQuerySchema = v.object({
  weekStart: calendarDateSchema,
  timezone: timezoneSchema,
});

/** Runtime contract for one day of logged, expected, and missing time. */
export const weeklyTimeDaySchema = v.object({
  date: calendarDateSchema,
  totalMinutes: minutesSchema,
  expectedMinutes: minutesSchema,
  missingMinutes: minutesSchema,
});

/** Runtime contract for a project's entries and seven daily totals. */
export const weeklyTimeProjectSchema = v.object({
  projectId: v.nullable(v.string()),
  entries: v.array(timeEntryDtoSchema),
  dailyMinutes: v.array(minutesSchema),
  totalMinutes: minutesSchema,
});

/** Runtime contract for a Monday-through-Sunday timesheet summary. */
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

/** Validates the destination week and timezone for a weekly copy operation. */
export const copyPreviousWeekInputSchema = v.object({
  weekStart: calendarDateSchema,
  timezone: timezoneSchema,
});

/** Runtime contract for the number of entries created by a weekly copy. */
export const copyPreviousWeekResultSchema = v.object({
  copiedEntries: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

/** Input for starting the current user's workspace timer. */
export type StartTimerInput = v.InferOutput<typeof startTimerInputSchema>;

/** Manual work represented by an interval or a fixed duration. */
export type AddManualTimeInput = v.InferOutput<typeof addManualTimeInputSchema>;

/** Editable fields on an unlocked time entry. */
export type UpdateTimeEntryInput = v.InferOutput<typeof updateTimeEntryInputSchema>;

/** Filters for the current user's time-entry history. */
export type TimeEntryListQuery = v.InferOutput<typeof timeEntryListQuerySchema>;

/** API representation of a time entry. Dates use ISO-8601 strings. */
export type TimeEntryDto = v.InferOutput<typeof timeEntryDtoSchema>;
/** Query for one Monday-through-Sunday timesheet. */
export type WeeklyTimeQuery = v.InferOutput<typeof weeklyTimeQuerySchema>;
/** Weekly entries and daily expectation totals for the current user. */
export type WeeklyTimeSummary = v.InferOutput<typeof weeklyTimeSummarySchema>;
/** Input used to copy the preceding week into the selected week. */
export type CopyPreviousWeekInput = v.InferOutput<typeof copyPreviousWeekInputSchema>;
