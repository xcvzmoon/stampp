import * as v from 'valibot';
import { calendarDateSchema, idSchema, isoDateSchema } from './schemas.ts';

export const attendanceSourceSchema = v.picklist(['clock', 'manual']);

export const timezoneSchema = v.pipe(
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

export const attendanceNoteSchema = v.pipe(v.string(), v.trim(), v.maxLength(500));

export const clockInInputSchema = v.object({
  timezone: timezoneSchema,
  note: v.optional(attendanceNoteSchema),
});

export const clockOutInputSchema = v.object({
  note: v.optional(attendanceNoteSchema),
});

export const createAttendanceInputSchema = v.object({
  userId: v.optional(idSchema),
  clockInAt: isoDateSchema,
  clockOutAt: v.optional(v.nullable(isoDateSchema)),
  timezone: timezoneSchema,
  note: v.optional(attendanceNoteSchema),
});

export const updateAttendanceInputSchema = v.object({
  clockInAt: v.optional(isoDateSchema),
  clockOutAt: v.optional(v.nullable(isoDateSchema)),
  timezone: v.optional(timezoneSchema),
  note: v.optional(v.nullable(attendanceNoteSchema)),
});

export const attendanceListQuerySchema = v.object({
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
  from: v.optional(calendarDateSchema),
  to: v.optional(calendarDateSchema),
});

export const attendanceDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  clockInAt: v.string(),
  clockOutAt: v.nullable(v.string()),
  durationMinutes: v.nullable(v.number()),
  workDate: calendarDateSchema,
  timezone: v.string(),
  source: attendanceSourceSchema,
  note: v.nullable(v.string()),
  state: v.picklist(['open', 'closed']),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const attendanceListResultSchema = v.object({
  items: v.array(attendanceDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const currentAttendanceSchema = v.object({
  clockedIn: v.boolean(),
  record: v.nullable(attendanceDtoSchema),
  elapsedMinutes: v.nullable(v.number()),
});

export type AttendanceSource = v.InferOutput<typeof attendanceSourceSchema>;
export type ClockInInput = v.InferOutput<typeof clockInInputSchema>;
export type ClockOutInput = v.InferOutput<typeof clockOutInputSchema>;
export type CreateAttendanceInput = v.InferOutput<typeof createAttendanceInputSchema>;
export type UpdateAttendanceInput = v.InferOutput<typeof updateAttendanceInputSchema>;
export type AttendanceListQuery = v.InferOutput<typeof attendanceListQuerySchema>;
export type AttendanceDto = v.InferOutput<typeof attendanceDtoSchema>;
export type AttendanceListResult = v.InferOutput<typeof attendanceListResultSchema>;
export type CurrentAttendance = v.InferOutput<typeof currentAttendanceSchema>;
