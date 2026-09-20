import * as v from 'valibot';
import { calendarDateSchema, idSchema } from './schemas.ts';

export const timesheetStatusSchema = v.picklist(['submitted', 'approved', 'rejected']);

export const timesheetActionSchema = v.picklist(['submit', 'withdraw', 'approve', 'reject']);

export const decisionNoteSchema = v.pipe(v.string(), v.trim(), v.maxLength(2000));

export const submitTimesheetInputSchema = v.object({
  weekStart: calendarDateSchema,
  note: v.optional(decisionNoteSchema),
});

export const withdrawTimesheetInputSchema = v.object({
  weekStart: calendarDateSchema,
});

export const decideTimesheetInputSchema = v.object({
  note: v.optional(decisionNoteSchema),
});

export const timesheetListQuerySchema = v.object({
  weekStart: v.optional(calendarDateSchema),
  userId: v.optional(idSchema),
  status: v.optional(timesheetStatusSchema),
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
});

export const timesheetDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  weekStart: calendarDateSchema,
  status: timesheetStatusSchema,
  submittedAt: v.nullable(v.string()),
  submitNote: v.nullable(v.string()),
  decidedAt: v.nullable(v.string()),
  decidedBy: v.nullable(v.string()),
  decisionNote: v.nullable(v.string()),
  lockedAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const timesheetListResultSchema = v.object({
  items: v.array(timesheetDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const ownTimesheetStateSchema = v.object({
  weekStart: calendarDateSchema,
  status: v.nullable(timesheetStatusSchema),
  timesheet: v.nullable(timesheetDtoSchema),
  editable: v.boolean(),
});

export type TimesheetStatus = v.InferOutput<typeof timesheetStatusSchema>;
export type SubmitTimesheetInput = v.InferOutput<typeof submitTimesheetInputSchema>;
export type WithdrawTimesheetInput = v.InferOutput<typeof withdrawTimesheetInputSchema>;
export type DecideTimesheetInput = v.InferOutput<typeof decideTimesheetInputSchema>;
export type TimesheetListQuery = v.InferOutput<typeof timesheetListQuerySchema>;
export type TimesheetDto = v.InferOutput<typeof timesheetDtoSchema>;
export type OwnTimesheetState = v.InferOutput<typeof ownTimesheetStateSchema>;
