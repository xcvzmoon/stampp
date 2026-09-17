import type { AuthorizedContext } from '@stampp/access';
import type { TimeEntry } from '@stampp/database';
import type {
  AddManualTimeInput,
  StartTimerInput,
  TimeEntryDto,
  TimeEntryListQuery,
  UpdateTimeEntryInput,
} from '@stampp/shared';
import { projects, tasks, timeEntries } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq, gt, gte, isNull, lte, or } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '../middleware/request-id.ts';
import { recordAudit } from './audit.ts';

type ListTimeEntriesOptions = TimeEntryListQuery & { limit: number };

const databaseErrorSchema = v.object({
  code: v.optional(v.string()),
  constraint_name: v.optional(v.string()),
});

function toTimeEntryDto(row: TimeEntry): TimeEntryDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    projectId: row.projectId,
    taskId: row.taskId,
    description: row.description,
    billable: row.billable,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    timezone: row.timezone,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Time entry not found', requestId);
}

function locked(requestId: string) {
  return toApiError(
    ERROR_CODES.TIME_ENTRY_LOCKED,
    'Locked time entries cannot be changed',
    requestId,
  );
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Postgres catch-boundary classifier
function mapConstraintError(error: unknown, requestId: string): never {
  const result = v.safeParse(databaseErrorSchema, error);
  if (result.success) {
    if (result.output.constraint_name === 'time_entries_one_running_per_user_unique') {
      throw toApiError(
        ERROR_CODES.TIMER_ALREADY_RUNNING,
        'A timer is already running in this workspace',
        requestId,
      );
    }
    if (
      result.output.code === '23P01' ||
      result.output.constraint_name === 'time_entries_no_overlapping_intervals'
    ) {
      throw toApiError(
        ERROR_CODES.TIME_ENTRY_OVERLAP,
        'Time entry overlaps an existing entry',
        requestId,
      );
    }
  }
  throw error;
}

async function resolveAssignment(
  ctx: AuthorizedContext,
  projectId: string | null | undefined,
  taskId: string | null | undefined,
  requestId: string,
): Promise<{ projectId: string | null; taskId: string | null; defaultBillable: boolean }> {
  if (!projectId && taskId) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'A task requires a project', requestId);
  }
  if (!projectId) {
    return { projectId: null, taskId: null, defaultBillable: true };
  }

  const projectRows = await ctx.db.client
    .select({ id: projects.id, status: projects.status, billable: projects.billable })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  const project = projectRows[0];
  if (!project) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'Project not found', requestId);
  }
  if (project.status !== 'active') {
    throw toApiError(ERROR_CODES.PROJECT_NOT_ACTIVE, 'Project is not active', requestId);
  }

  if (taskId) {
    const taskRows = await ctx.db.client
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, ctx.workspaceId),
          eq(tasks.projectId, projectId),
          eq(tasks.id, taskId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    const task = taskRows[0];
    if (!task) {
      throw toApiError(ERROR_CODES.NOT_FOUND, 'Task not found', requestId);
    }
    if (task.status !== 'active') {
      throw toApiError(ERROR_CODES.PROJECT_NOT_ACTIVE, 'Task is not active', requestId);
    }
  }

  return { projectId, taskId: taskId ?? null, defaultBillable: project.billable };
}

async function getOwnedEntry(
  ctx: AuthorizedContext,
  entryId: string,
  requestId: string,
): Promise<TimeEntry> {
  const rows = await ctx.db.client
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, ctx.workspaceId),
        eq(timeEntries.userId, ctx.userId),
        eq(timeEntries.id, entryId),
      ),
    )
    .limit(1);
  const entry = rows[0];
  if (!entry) {
    throw notFound(requestId);
  }
  return entry;
}

/** Returns the current user's running timer in a workspace. */
export async function getRunningTimer(ctx: AuthorizedContext): Promise<TimeEntryDto | null> {
  const rows = await ctx.db.client
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, ctx.workspaceId),
        eq(timeEntries.userId, ctx.userId),
        isNull(timeEntries.endAt),
        isNull(timeEntries.durationMinutes),
      ),
    )
    .limit(1);
  return rows[0] ? toTimeEntryDto(rows[0]) : null;
}

/** Starts one timer for the current user in the workspace. */
export async function startTimer(
  ctx: AuthorizedContext,
  input: StartTimerInput,
  requestId: string,
): Promise<TimeEntryDto> {
  const assignment = await resolveAssignment(ctx, input.projectId, input.taskId, requestId);
  try {
    const rows = await ctx.db.client
      .insert(timeEntries)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        projectId: assignment.projectId,
        taskId: assignment.taskId,
        description: input.description ?? '',
        billable: input.billable ?? assignment.defaultBillable,
        startAt: new Date(),
        timezone: input.timezone,
      })
      .returning();
    const entry = rows[0];
    if (!entry) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to start timer', requestId);
    }
    await recordAudit(ctx, {
      action: 'time_entry.started',
      entityType: 'time_entry',
      entityId: entry.id,
      after: entry,
    });
    return toTimeEntryDto(entry);
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

/** Stops a running timer owned by the current user. */
export async function stopTimer(
  ctx: AuthorizedContext,
  entryId: string,
  requestId: string,
): Promise<TimeEntryDto> {
  const before = await getOwnedEntry(ctx, entryId, requestId);
  if (before.lockedAt) throw locked(requestId);
  if (!before.startAt || before.endAt) {
    throw toApiError(ERROR_CODES.CONFLICT, 'Time entry is not a running timer', requestId);
  }

  try {
    const rows = await ctx.db.client
      .update(timeEntries)
      .set({ endAt: new Date() })
      .where(
        and(
          eq(timeEntries.workspaceId, ctx.workspaceId),
          eq(timeEntries.userId, ctx.userId),
          eq(timeEntries.id, entryId),
          isNull(timeEntries.endAt),
        ),
      )
      .returning();
    const entry = rows[0];
    if (!entry) throw notFound(requestId);
    await recordAudit(ctx, {
      action: 'time_entry.stopped',
      entityType: 'time_entry',
      entityId: entry.id,
      before,
      after: entry,
    });
    return toTimeEntryDto(entry);
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

/** Adds an interval or fixed-duration entry for the current user. */
export async function addManualTime(
  ctx: AuthorizedContext,
  input: AddManualTimeInput,
  requestId: string,
): Promise<TimeEntryDto> {
  const assignment = await resolveAssignment(ctx, input.projectId, input.taskId, requestId);
  const interval = input.kind === 'interval';
  const startAt = interval ? new Date(input.startAt) : null;
  const endAt = interval ? new Date(input.endAt) : null;
  if (startAt && endAt && endAt <= startAt) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'End time must be after start time', requestId);
  }

  try {
    const rows = await ctx.db.client
      .insert(timeEntries)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        projectId: assignment.projectId,
        taskId: assignment.taskId,
        description: input.description ?? '',
        billable: input.billable ?? assignment.defaultBillable,
        startAt,
        endAt,
        durationMinutes: interval ? null : input.durationMinutes,
        timezone: input.timezone,
      })
      .returning();
    const entry = rows[0];
    if (!entry) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to add time entry', requestId);
    }
    await recordAudit(ctx, {
      action: 'time_entry.created',
      entityType: 'time_entry',
      entityId: entry.id,
      after: entry,
    });
    return toTimeEntryDto(entry);
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

/** Lists the current user's entries in ascending ID order. */
export async function listTimeEntries(
  ctx: AuthorizedContext,
  options: ListTimeEntriesOptions,
): Promise<{ items: TimeEntryDto[]; nextCursor: string | null }> {
  const conditions = [
    eq(timeEntries.workspaceId, ctx.workspaceId),
    eq(timeEntries.userId, ctx.userId),
  ];
  if (options.cursor) conditions.push(gt(timeEntries.id, options.cursor));
  if (options.projectId) conditions.push(eq(timeEntries.projectId, options.projectId));
  if (options.from) {
    const from = new Date(options.from);
    const condition = or(gte(timeEntries.startAt, from), gte(timeEntries.createdAt, from));
    if (condition) conditions.push(condition);
  }
  if (options.to) {
    const to = new Date(options.to);
    const condition = or(lte(timeEntries.startAt, to), lte(timeEntries.createdAt, to));
    if (condition) conditions.push(condition);
  }

  const rows = await ctx.db.client
    .select()
    .from(timeEntries)
    .where(and(...conditions))
    .orderBy(asc(timeEntries.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toTimeEntryDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

/** Updates an unlocked entry owned by the current user. */
export async function updateTimeEntry(
  ctx: AuthorizedContext,
  entryId: string,
  input: UpdateTimeEntryInput,
  requestId: string,
): Promise<TimeEntryDto> {
  const before = await getOwnedEntry(ctx, entryId, requestId);
  if (before.lockedAt) throw locked(requestId);
  if (Object.keys(input).length === 0) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'At least one field is required', requestId);
  }

  const assignment = await resolveAssignment(
    ctx,
    input.projectId === undefined ? before.projectId : input.projectId,
    input.taskId === undefined ? before.taskId : input.taskId,
    requestId,
  );
  const nextStartAt = input.startAt === undefined ? before.startAt : new Date(input.startAt);
  const nextEndAt =
    input.endAt === undefined ? before.endAt : input.endAt === null ? null : new Date(input.endAt);
  const nextDuration =
    input.durationMinutes === undefined ? before.durationMinutes : input.durationMinutes;
  const isInterval = nextStartAt !== null && nextDuration === null;
  const isDuration = nextStartAt === null && nextEndAt === null && nextDuration !== null;
  if (!isInterval && !isDuration) {
    throw toApiError(
      ERROR_CODES.BAD_REQUEST,
      'Entry must contain either an interval or a duration',
      requestId,
    );
  }
  if (nextStartAt && nextEndAt && nextEndAt <= nextStartAt) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'End time must be after start time', requestId);
  }

  try {
    const rows = await ctx.db.client
      .update(timeEntries)
      .set({
        projectId: assignment.projectId,
        taskId: assignment.taskId,
        description: input.description ?? before.description,
        billable: input.billable ?? before.billable,
        startAt: nextStartAt,
        endAt: nextEndAt,
        durationMinutes: nextDuration,
        timezone: input.timezone ?? before.timezone,
      })
      .where(
        and(
          eq(timeEntries.workspaceId, ctx.workspaceId),
          eq(timeEntries.userId, ctx.userId),
          eq(timeEntries.id, entryId),
          isNull(timeEntries.lockedAt),
        ),
      )
      .returning();
    const entry = rows[0];
    if (!entry) throw notFound(requestId);
    await recordAudit(ctx, {
      action: 'time_entry.updated',
      entityType: 'time_entry',
      entityId: entry.id,
      before,
      after: entry,
    });
    return toTimeEntryDto(entry);
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

/** Permanently removes an unlocked entry owned by the current user. */
export async function removeTimeEntry(
  ctx: AuthorizedContext,
  entryId: string,
  requestId: string,
): Promise<void> {
  const before = await getOwnedEntry(ctx, entryId, requestId);
  if (before.lockedAt) throw locked(requestId);
  const rows = await ctx.db.client
    .delete(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, ctx.workspaceId),
        eq(timeEntries.userId, ctx.userId),
        eq(timeEntries.id, entryId),
        isNull(timeEntries.lockedAt),
      ),
    )
    .returning({ id: timeEntries.id });
  if (!rows[0]) throw notFound(requestId);
  await recordAudit(ctx, {
    action: 'time_entry.deleted',
    entityType: 'time_entry',
    entityId: entryId,
    before,
  });
}
