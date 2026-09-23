import * as v from 'valibot';
import { calendarDateSchema, idSchema } from './schemas.ts';

export const weeklyHoursSchema = v.pipe(v.number(), v.minValue(0.5), v.maxValue(168));

export const upsertCapacityInputSchema = v.object({
  userId: v.optional(idSchema),
  weeklyHours: weeklyHoursSchema,
  note: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(500)))),
});

export const createAssignmentInputSchema = v.object({
  userId: idSchema,
  projectId: idSchema,
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  hoursPerWeek: weeklyHoursSchema,
  note: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(500)))),
});

export const updateAssignmentInputSchema = v.object({
  startDate: v.optional(calendarDateSchema),
  endDate: v.optional(calendarDateSchema),
  hoursPerWeek: v.optional(weeklyHoursSchema),
  note: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(500)))),
  active: v.optional(v.boolean()),
});

export const scheduleListQuerySchema = v.object({
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
  projectId: v.optional(idSchema),
  from: v.optional(calendarDateSchema),
  to: v.optional(calendarDateSchema),
  active: v.optional(
    v.pipe(
      v.string(),
      v.picklist(['true', 'false']),
      v.transform((input) => input === 'true'),
    ),
  ),
});

export const workloadQuerySchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  userId: v.optional(idSchema),
});

export const capacityDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  weeklyHours: v.number(),
  note: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const capacityListResultSchema = v.object({
  items: v.array(capacityDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const assignmentDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  projectId: v.string(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  hoursPerWeek: v.number(),
  note: v.nullable(v.string()),
  active: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const assignmentListResultSchema = v.object({
  items: v.array(assignmentDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const workloadStatusSchema = v.picklist([
  'overbooked',
  'on_track',
  'underutilized',
  'unscheduled',
]);

export const workloadMemberSchema = v.object({
  userId: v.string(),
  capacityHours: v.number(),
  scheduledHours: v.number(),
  trackedHours: v.number(),
  status: workloadStatusSchema,
  scheduleVarianceHours: v.number(),
  capacityVarianceHours: v.number(),
  assignments: v.array(
    v.object({
      assignmentId: v.string(),
      projectId: v.string(),
      projectName: v.nullable(v.string()),
      hoursPerWeek: v.number(),
    }),
  ),
});

export const workloadResultSchema = v.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  members: v.array(workloadMemberSchema),
});

export type UpsertCapacityInput = v.InferOutput<typeof upsertCapacityInputSchema>;
export type CreateAssignmentInput = v.InferOutput<typeof createAssignmentInputSchema>;
export type UpdateAssignmentInput = v.InferOutput<typeof updateAssignmentInputSchema>;
export type ScheduleListQuery = v.InferOutput<typeof scheduleListQuerySchema>;
export type CapacityDto = v.InferOutput<typeof capacityDtoSchema>;
export type CapacityListResult = v.InferOutput<typeof capacityListResultSchema>;
export type AssignmentDto = v.InferOutput<typeof assignmentDtoSchema>;
export type AssignmentListResult = v.InferOutput<typeof assignmentListResultSchema>;
export type WorkloadStatus = v.InferOutput<typeof workloadStatusSchema>;
export type WorkloadMember = v.InferOutput<typeof workloadMemberSchema>;
export type WorkloadResult = v.InferOutput<typeof workloadResultSchema>;
