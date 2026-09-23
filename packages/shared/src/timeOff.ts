import * as v from 'valibot';
import { calendarDateSchema, idSchema } from './schemas.ts';

export const timeOffStatusSchema = v.picklist(['pending', 'approved', 'rejected', 'canceled']);
export const timeOffActionSchema = v.picklist(['withdraw', 'approve', 'reject']);

export const timeOffNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
export const timeOffNoteSchema = v.pipe(v.string(), v.trim(), v.maxLength(2000));
export const timeOffDaysSchema = v.pipe(v.number(), v.minValue(0.5), v.maxValue(366));

export const createTimeOffTypeInputSchema = v.object({
  name: timeOffNameSchema,
  color: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'))),
  paid: v.optional(v.boolean(), true),
  annualAllowanceDays: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(366)))),
  requiresApproval: v.optional(v.boolean(), true),
  active: v.optional(v.boolean(), true),
});

export const updateTimeOffTypeInputSchema = v.object({
  name: v.optional(timeOffNameSchema),
  color: v.optional(
    v.nullable(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'))),
  ),
  paid: v.optional(v.boolean()),
  annualAllowanceDays: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(366)))),
  requiresApproval: v.optional(v.boolean()),
  active: v.optional(v.boolean()),
});

export const createHolidayInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  date: calendarDateSchema,
});

export const createTimeOffRequestInputSchema = v.object({
  timeOffTypeId: idSchema,
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  note: v.optional(timeOffNoteSchema),
});

export const decideTimeOffInputSchema = v.object({
  note: v.optional(timeOffNoteSchema),
});

export const timeOffListQuerySchema = v.object({
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
  userId: v.optional(idSchema),
  status: v.optional(timeOffStatusSchema),
  typeId: v.optional(idSchema),
  from: v.optional(calendarDateSchema),
  to: v.optional(calendarDateSchema),
});

export const timeOffBalanceQuerySchema = v.object({
  year: v.pipe(
    v.string(),
    v.transform((input) => Number(input)),
    v.integer('year must be an integer'),
    v.minValue(2000),
    v.maxValue(2100),
  ),
  userId: v.optional(idSchema),
});

export const timeOffCalendarQuerySchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
});

export const timeOffTypeDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  color: v.nullable(v.string()),
  paid: v.boolean(),
  annualAllowanceDays: v.nullable(v.number()),
  requiresApproval: v.boolean(),
  active: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const holidayDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  date: calendarDateSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const timeOffRequestDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  timeOffTypeId: v.string(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  days: v.number(),
  status: timeOffStatusSchema,
  note: v.nullable(v.string()),
  decidedAt: v.nullable(v.string()),
  decidedBy: v.nullable(v.string()),
  decisionNote: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const timeOffRequestListResultSchema = v.object({
  items: v.array(timeOffRequestDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const timeOffTypeListResultSchema = v.object({
  items: v.array(timeOffTypeDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const holidayListResultSchema = v.object({
  items: v.array(holidayDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const timeOffBalanceDtoSchema = v.object({
  timeOffTypeId: v.string(),
  name: v.string(),
  color: v.nullable(v.string()),
  paid: v.boolean(),
  allowanceDays: v.nullable(v.number()),
  approvedDays: v.number(),
  pendingDays: v.number(),
  usedDays: v.number(),
  remainingDays: v.nullable(v.number()),
});

export const timeOffBalanceListResultSchema = v.object({
  year: v.number(),
  items: v.array(timeOffBalanceDtoSchema),
});

export const timeOffCalendarDaySchema = v.object({
  date: calendarDateSchema,
  holiday: v.nullable(v.object({ id: v.string(), name: v.string() })),
  requests: v.array(
    v.object({
      id: v.string(),
      userId: v.string(),
      timeOffTypeId: v.string(),
      typeName: v.string(),
      color: v.nullable(v.string()),
      startDate: calendarDateSchema,
      endDate: calendarDateSchema,
      status: timeOffStatusSchema,
    }),
  ),
});

export const timeOffCalendarResultSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  days: v.array(timeOffCalendarDaySchema),
});

export type TimeOffStatus = v.InferOutput<typeof timeOffStatusSchema>;
export type CreateTimeOffTypeInput = v.InferOutput<typeof createTimeOffTypeInputSchema>;
export type UpdateTimeOffTypeInput = v.InferOutput<typeof updateTimeOffTypeInputSchema>;
export type CreateHolidayInput = v.InferOutput<typeof createHolidayInputSchema>;
export type CreateTimeOffRequestInput = v.InferOutput<typeof createTimeOffRequestInputSchema>;
export type DecideTimeOffInput = v.InferOutput<typeof decideTimeOffInputSchema>;
export type TimeOffListQuery = v.InferOutput<typeof timeOffListQuerySchema>;
export type TimeOffTypeDto = v.InferOutput<typeof timeOffTypeDtoSchema>;
export type HolidayDto = v.InferOutput<typeof holidayDtoSchema>;
export type TimeOffRequestDto = v.InferOutput<typeof timeOffRequestDtoSchema>;
export type TimeOffRequestListResult = v.InferOutput<typeof timeOffRequestListResultSchema>;
export type TimeOffTypeListResult = v.InferOutput<typeof timeOffTypeListResultSchema>;
export type HolidayListResult = v.InferOutput<typeof holidayListResultSchema>;
export type TimeOffBalanceDto = v.InferOutput<typeof timeOffBalanceDtoSchema>;
export type TimeOffBalanceListResult = v.InferOutput<typeof timeOffBalanceListResultSchema>;
export type TimeOffCalendarResult = v.InferOutput<typeof timeOffCalendarResultSchema>;
