import type { AuthorizedContext } from '@stampp/access';
import type { MemberCapacity, ProjectAssignment } from '@stampp/database';
import type {
  AssignmentDto,
  AssignmentListResult,
  CapacityDto,
  CapacityListResult,
  CreateAssignmentInput,
  ScheduleListQuery,
  UpdateAssignmentInput,
  UpsertCapacityInput,
  WorkloadMember,
  WorkloadResult,
} from '@stampp/shared';
import {
  memberCapacities,
  members,
  projectAssignments,
  projects,
  timeEntries,
} from '@stampp/database';
import {
  DEFAULT_WEEKLY_CAPACITY_HOURS,
  assignmentCoversRange,
  hasPermission,
  isValidScheduleRange,
  isValidWeeklyHours,
  minutesToHours,
  resolveWorkload,
} from '@stampp/domain';
import { DEFAULT_LIST_LIMIT, ERROR_CODES, scheduleListQuerySchema } from '@stampp/shared';
import { and, asc, eq, gte, gt, lte, type SQL } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { isUniqueViolation } from '~/server/utils/catalog.ts';

type ListAssignmentOptions = ScheduleListQuery & { limit: number };

function notFound(requestId: string, entity: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, `${entity} not found`, requestId);
}

function invalidRange(requestId: string, message: string) {
  return toApiError(ERROR_CODES.SCHEDULE_INVALID_RANGE, message, requestId);
}

function parseHours(value: string): number {
  return Number(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toCapacityDto(row: MemberCapacity): CapacityDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    weeklyHours: parseHours(row.weeklyHours),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAssignmentDto(row: ProjectAssignment): AssignmentDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    projectId: row.projectId,
    startDate: row.startDate,
    endDate: row.endDate,
    hoursPerWeek: parseHours(row.hoursPerWeek),
    note: row.note,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function canReadTeam(ctx: AuthorizedContext): boolean {
  return hasPermission(ctx.permissions, 'schedule:read:team');
}

async function assertWorkspaceMember(
  ctx: AuthorizedContext,
  userId: string,
  requestId: string,
): Promise<void> {
  const rows = await ctx.db.client
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.organizationId, ctx.workspaceId), eq(members.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Target user is not a workspace member', requestId);
  }
}

export async function listCapacities(
  ctx: AuthorizedContext,
  options: { limit: number; cursor?: string; userId?: string },
): Promise<CapacityListResult> {
  const conditions: SQL[] = [eq(memberCapacities.workspaceId, ctx.workspaceId)];
  if (!canReadTeam(ctx)) {
    conditions.push(eq(memberCapacities.userId, ctx.userId));
  } else if (options.userId) {
    conditions.push(eq(memberCapacities.userId, options.userId));
  }
  if (options.cursor) conditions.push(gt(memberCapacities.id, options.cursor));
  const rows = await ctx.db.client
    .select()
    .from(memberCapacities)
    .where(and(...conditions))
    .orderBy(asc(memberCapacities.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toCapacityDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

async function getCapacityRow(
  ctx: AuthorizedContext,
  userId: string,
): Promise<MemberCapacity | null> {
  const rows = await ctx.db.client
    .select()
    .from(memberCapacities)
    .where(
      and(eq(memberCapacities.workspaceId, ctx.workspaceId), eq(memberCapacities.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCapacity(
  ctx: AuthorizedContext,
  input: UpsertCapacityInput,
  requestId: string,
): Promise<CapacityDto> {
  if (!isValidWeeklyHours(input.weeklyHours)) {
    throw invalidRange(requestId, 'weeklyHours must be between 0.5 and 168');
  }
  const targetUserId = input.userId ?? ctx.userId;
  if (targetUserId !== ctx.userId && !hasPermission(ctx.permissions, 'schedule:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You cannot change other members capacity', requestId);
  }
  await assertWorkspaceMember(ctx, targetUserId, requestId);

  const existing = await getCapacityRow(ctx, targetUserId);
  try {
    if (existing) {
      const rows = await ctx.db.client
        .update(memberCapacities)
        .set({
          weeklyHours: String(input.weeklyHours),
          note: input.note ?? existing.note,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(memberCapacities.id, existing.id),
            eq(memberCapacities.workspaceId, ctx.workspaceId),
          ),
        )
        .returning();
      const row = rows[0];
      if (!row) throw notFound(requestId, 'Capacity');
      await recordAudit(ctx, requestId, {
        action: 'member_capacity.updated',
        entityType: 'member_capacity',
        entityId: row.id,
        before: existing,
        after: row,
      });
      return toCapacityDto(row);
    }

    const rows = await ctx.db.client
      .insert(memberCapacities)
      .values({
        workspaceId: ctx.workspaceId,
        userId: targetUserId,
        weeklyHours: String(input.weeklyHours),
        note: input.note ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to save capacity', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'member_capacity.created',
      entityType: 'member_capacity',
      entityId: row.id,
      after: row,
    });
    return toCapacityDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Capacity already exists for member', requestId);
    }
    throw error;
  }
}

export async function listAssignments(
  ctx: AuthorizedContext,
  options: ListAssignmentOptions,
): Promise<AssignmentListResult> {
  const conditions: SQL[] = [eq(projectAssignments.workspaceId, ctx.workspaceId)];
  if (!canReadTeam(ctx)) {
    conditions.push(eq(projectAssignments.userId, ctx.userId));
  } else if (options.userId) {
    conditions.push(eq(projectAssignments.userId, options.userId));
  }
  if (options.projectId) conditions.push(eq(projectAssignments.projectId, options.projectId));
  if (options.cursor) conditions.push(gt(projectAssignments.id, options.cursor));
  if (options.active !== undefined) conditions.push(eq(projectAssignments.active, options.active));
  if (options.from) conditions.push(gte(projectAssignments.endDate, options.from));
  if (options.to) conditions.push(lte(projectAssignments.startDate, options.to));

  const rows = await ctx.db.client
    .select()
    .from(projectAssignments)
    .where(and(...conditions))
    .orderBy(asc(projectAssignments.startDate), asc(projectAssignments.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toAssignmentDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

async function getAssignmentRow(
  ctx: AuthorizedContext,
  assignmentId: string,
  requestId: string,
): Promise<ProjectAssignment> {
  const rows = await ctx.db.client
    .select()
    .from(projectAssignments)
    .where(
      and(
        eq(projectAssignments.id, assignmentId),
        eq(projectAssignments.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Assignment');
  return row;
}

async function assertActiveProject(
  ctx: AuthorizedContext,
  projectId: string,
  requestId: string,
): Promise<void> {
  const rows = await ctx.db.client
    .select({ id: projects.id, status: projects.status })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Project');
  if (row.status !== 'active') {
    throw toApiError(ERROR_CODES.PROJECT_NOT_ACTIVE, 'Project is not active', requestId);
  }
}

export async function createAssignment(
  ctx: AuthorizedContext,
  input: CreateAssignmentInput,
  requestId: string,
): Promise<AssignmentDto> {
  if (!hasPermission(ctx.permissions, 'schedule:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Schedule manage permission is required', requestId);
  }
  if (!isValidScheduleRange(input.startDate, input.endDate)) {
    throw invalidRange(requestId, 'endDate must be on or after startDate');
  }
  if (!isValidWeeklyHours(input.hoursPerWeek)) {
    throw invalidRange(requestId, 'hoursPerWeek must be between 0.5 and 168');
  }
  await assertWorkspaceMember(ctx, input.userId, requestId);
  await assertActiveProject(ctx, input.projectId, requestId);

  try {
    const rows = await ctx.db.client
      .insert(projectAssignments)
      .values({
        workspaceId: ctx.workspaceId,
        userId: input.userId,
        projectId: input.projectId,
        startDate: input.startDate,
        endDate: input.endDate,
        hoursPerWeek: String(input.hoursPerWeek),
        note: input.note ?? null,
        active: true,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create assignment', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'project_assignment.created',
      entityType: 'project_assignment',
      entityId: row.id,
      after: row,
    });
    return toAssignmentDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Assignment conflicted with existing data', requestId);
    }
    throw error;
  }
}

export async function updateAssignment(
  ctx: AuthorizedContext,
  assignmentId: string,
  input: UpdateAssignmentInput,
  requestId: string,
): Promise<AssignmentDto> {
  if (!hasPermission(ctx.permissions, 'schedule:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Schedule manage permission is required', requestId);
  }
  const before = await getAssignmentRow(ctx, assignmentId, requestId);
  const startDate = input.startDate ?? before.startDate;
  const endDate = input.endDate ?? before.endDate;
  const hoursPerWeek = input.hoursPerWeek ?? parseHours(before.hoursPerWeek);
  if (!isValidScheduleRange(startDate, endDate)) {
    throw invalidRange(requestId, 'endDate must be on or after startDate');
  }
  if (!isValidWeeklyHours(hoursPerWeek)) {
    throw invalidRange(requestId, 'hoursPerWeek must be between 0.5 and 168');
  }

  const rows = await ctx.db.client
    .update(projectAssignments)
    .set({
      startDate,
      endDate,
      hoursPerWeek: String(hoursPerWeek),
      note: input.note === undefined ? before.note : input.note,
      active: input.active ?? before.active,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectAssignments.id, before.id),
        eq(projectAssignments.workspaceId, ctx.workspaceId),
      ),
    )
    .returning();
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Assignment');
  await recordAudit(ctx, requestId, {
    action: 'project_assignment.updated',
    entityType: 'project_assignment',
    entityId: row.id,
    before,
    after: row,
  });
  return toAssignmentDto(row);
}

export async function deleteAssignment(
  ctx: AuthorizedContext,
  assignmentId: string,
  requestId: string,
): Promise<void> {
  if (!hasPermission(ctx.permissions, 'schedule:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Schedule manage permission is required', requestId);
  }
  const before = await getAssignmentRow(ctx, assignmentId, requestId);
  await ctx.db.client
    .delete(projectAssignments)
    .where(
      and(
        eq(projectAssignments.id, before.id),
        eq(projectAssignments.workspaceId, ctx.workspaceId),
      ),
    );
  await recordAudit(ctx, requestId, {
    action: 'project_assignment.deleted',
    entityType: 'project_assignment',
    entityId: before.id,
    before,
  });
}

export async function getWorkload(
  ctx: AuthorizedContext,
  options: { from: string; to: string; userId?: string },
  requestId: string,
): Promise<WorkloadResult> {
  if (!isValidScheduleRange(options.from, options.to)) {
    throw invalidRange(requestId, 'to must be on or after from');
  }
  const rangeDays =
    (new Date(`${options.to}T00:00:00.000Z`).getTime() -
      new Date(`${options.from}T00:00:00.000Z`).getTime()) /
      86_400_000 +
    1;
  if (rangeDays > 366) {
    throw invalidRange(requestId, 'Workload range is limited to one year');
  }

  const targetUser = options.userId;
  if (targetUser && targetUser !== ctx.userId && !canReadTeam(ctx)) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You cannot view other members workload', requestId);
  }

  const capacityConditions: SQL[] = [eq(memberCapacities.workspaceId, ctx.workspaceId)];
  const assignmentConditions: SQL[] = [
    eq(projectAssignments.workspaceId, ctx.workspaceId),
    eq(projectAssignments.active, true),
    gte(projectAssignments.endDate, options.from),
    lte(projectAssignments.startDate, options.to),
  ];
  const trackedConditions: SQL[] = [
    eq(timeEntries.workspaceId, ctx.workspaceId),
    gte(timeEntries.workDate, options.from),
    lte(timeEntries.workDate, options.to),
  ];

  if (!canReadTeam(ctx) || targetUser) {
    const userId = targetUser ?? ctx.userId;
    capacityConditions.push(eq(memberCapacities.userId, userId));
    assignmentConditions.push(eq(projectAssignments.userId, userId));
    trackedConditions.push(eq(timeEntries.userId, userId));
  }

  const [capacityRows, assignmentRows, trackedRows, projectRows] = await Promise.all([
    ctx.db.client
      .select()
      .from(memberCapacities)
      .where(and(...capacityConditions)),
    ctx.db.client
      .select()
      .from(projectAssignments)
      .where(and(...assignmentConditions))
      .orderBy(asc(projectAssignments.userId), asc(projectAssignments.startDate)),
    ctx.db.client
      .select({
        userId: timeEntries.userId,
        durationMinutes: timeEntries.durationMinutes,
        startAt: timeEntries.startAt,
        endAt: timeEntries.endAt,
      })
      .from(timeEntries)
      .where(and(...trackedConditions)),
    ctx.db.client
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.workspaceId, ctx.workspaceId)),
  ]);

  const projectNameById = new Map(projectRows.map((row) => [row.id, row.name]));
  const capacityByUser = new Map(capacityRows.map((row) => [row.userId, row]));
  const assignmentByUser = new Map<string, typeof assignmentRows>();
  for (const row of assignmentRows) {
    const list = assignmentByUser.get(row.userId);
    if (list) list.push(row);
    else assignmentByUser.set(row.userId, [row]);
  }

  const trackedMinutesByUser = new Map<string, number>();
  for (const row of trackedRows) {
    let minutes = 0;
    if (row.durationMinutes !== null) {
      minutes += row.durationMinutes;
    } else if (row.startAt && row.endAt) {
      minutes += Math.max(0, Math.floor((row.endAt.getTime() - row.startAt.getTime()) / 60_000));
    }
    trackedMinutesByUser.set(row.userId, (trackedMinutesByUser.get(row.userId) ?? 0) + minutes);
  }

  const userIds = new Set<string>();
  for (const id of capacityByUser.keys()) userIds.add(id);
  for (const id of assignmentByUser.keys()) userIds.add(id);
  for (const id of trackedMinutesByUser.keys()) userIds.add(id);
  if (userIds.size === 0) userIds.add(targetUser ?? ctx.userId);

  const weeks = rangeDays / 7;
  const membersOut: WorkloadMember[] = [];
  for (const userId of userIds) {
    const capacity = capacityByUser.get(userId);
    const weeklyCapacity = capacity
      ? parseHours(capacity.weeklyHours)
      : DEFAULT_WEEKLY_CAPACITY_HOURS;
    const assignments = assignmentByUser.get(userId) ?? [];
    let scheduledHours = 0;
    for (const assignment of assignments) {
      if (
        !assignmentCoversRange(assignment.startDate, assignment.endDate, options.from, options.to)
      ) {
        continue;
      }
      const overlapStart =
        assignment.startDate > options.from ? assignment.startDate : options.from;
      const overlapEnd = assignment.endDate < options.to ? assignment.endDate : options.to;
      const overlapDays =
        (new Date(`${overlapEnd}T00:00:00.000Z`).getTime() -
          new Date(`${overlapStart}T00:00:00.000Z`).getTime()) /
          86_400_000 +
        1;
      scheduledHours += parseHours(assignment.hoursPerWeek) * (overlapDays / 7);
    }
    const trackedHours = minutesToHours(trackedMinutesByUser.get(userId) ?? 0);
    const weekly = resolveWorkload({
      capacityHours: weeklyCapacity,
      scheduledHours: round2(scheduledHours / weeks),
      trackedHours: round2(trackedHours / weeks),
    });
    membersOut.push({
      userId,
      capacityHours: weekly.capacityHours,
      scheduledHours: weekly.scheduledHours,
      trackedHours: weekly.trackedHours,
      status: weekly.status,
      scheduleVarianceHours: weekly.scheduleVarianceHours,
      capacityVarianceHours: weekly.capacityVarianceHours,
      assignments: assignments
        .filter((row) =>
          assignmentCoversRange(row.startDate, row.endDate, options.from, options.to),
        )
        .map((row) => ({
          assignmentId: row.id,
          projectId: row.projectId,
          projectName: projectNameById.get(row.projectId) ?? null,
          hoursPerWeek: parseHours(row.hoursPerWeek),
        })),
    });
  }

  membersOut.sort((left, right) => left.userId.localeCompare(right.userId));
  return { from: options.from, to: options.to, members: membersOut };
}

export function parseScheduleListQuery(
  query: URLSearchParams,
  requestId: string,
): ListAssignmentOptions {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'userId', 'projectId', 'from', 'to', 'active']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(scheduleListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return { ...result.output, limit: result.output.limit ?? DEFAULT_LIST_LIMIT };
}

export function parseWorkloadQuery(
  query: URLSearchParams,
  requestId: string,
): { from: string; to: string; userId?: string } {
  const raw: Record<string, string> = {};
  for (const key of ['from', 'to', 'userId']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const schema = v.object({
    from: v.string(),
    to: v.string(),
    userId: v.optional(v.string()),
  });
  const result = v.safeParse(schema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'from and to are required',
      requestId,
      result.issues,
    );
  }
  return result.output;
}
