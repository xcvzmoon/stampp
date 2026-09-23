import type { AuthorizedContext } from '@stampp/access';
import type { TimeEntry } from '@stampp/database';
import type {
  AddManualTimeInput,
  StartTimerInput,
  TimeEntryDto,
  TimeEntryListQuery,
  TimeEntryTagRef,
  UpdateTimeEntryInput,
  WeeklyTimeQuery,
  WeeklyTimeSummary,
} from '@stampp/shared';
import { projects, tags, tasks, timeEntries, timeEntryTags } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { assertEntryWeekEditable, assertWeekEditable } from '~/server/utils/timesheets.ts';
import { emitWebhookEvent } from '~/server/utils/webhookEvents.ts';
import { addCalendarDays, calendarDateInTimezone } from '~/server/utils/week.ts';

type ListTimeEntriesOptions = TimeEntryListQuery & { limit: number };
type TagsByEntryId = Map<string, TimeEntryTagRef[]>;

export function weeklyTimeScope(
  workspaceId: string,
  userId: string,
  weekStart: string,
  weekEnd: string,
) {
  return and(
    eq(timeEntries.workspaceId, workspaceId),
    eq(timeEntries.userId, userId),
    gte(timeEntries.workDate, weekStart),
    lte(timeEntries.workDate, weekEnd),
  );
}

const databaseErrorSchema = v.object({
  code: v.optional(v.string()),
  constraint_name: v.optional(v.string()),
});

function toTimeEntryDto(row: TimeEntry, entryTags: TimeEntryTagRef[] = []): TimeEntryDto {
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
    workDate: row.workDate,
    timezone: row.timezone,
    tags: entryTags,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function hydrateTagsForEntries(
  ctx: AuthorizedContext,
  entryIds: string[],
): Promise<TagsByEntryId> {
  if (entryIds.length === 0) {
    return new Map();
  }

  const rows = await ctx.db.client
    .select({
      timeEntryId: timeEntryTags.timeEntryId,
      id: tags.id,
      name: tags.name,
    })
    .from(timeEntryTags)
    .innerJoin(tags, eq(tags.id, timeEntryTags.tagId))
    .where(
      and(
        eq(timeEntryTags.workspaceId, ctx.workspaceId),
        inArray(timeEntryTags.timeEntryId, entryIds),
      ),
    )
    .orderBy(asc(tags.name), asc(tags.id));

  const byEntry: TagsByEntryId = new Map();
  for (const row of rows) {
    const list = byEntry.get(row.timeEntryId);
    const ref = { id: row.id, name: row.name };
    if (list) {
      list.push(ref);
    } else {
      byEntry.set(row.timeEntryId, [ref]);
    }
  }
  return byEntry;
}

async function resolveActiveTags(
  ctx: AuthorizedContext,
  tagIds: string[],
  requestId: string,
): Promise<TimeEntryTagRef[]> {
  if (tagIds.length === 0) {
    return [];
  }

  const rows = await ctx.db.client
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(
      and(eq(tags.workspaceId, ctx.workspaceId), isNull(tags.deletedAt), inArray(tags.id, tagIds)),
    )
    .orderBy(asc(tags.name), asc(tags.id));

  if (rows.length !== tagIds.length) {
    throw toApiError(
      ERROR_CODES.BAD_REQUEST,
      'One or more tags are missing or archived',
      requestId,
    );
  }
  return rows;
}

async function replaceEntryTags(
  ctx: AuthorizedContext,
  entryId: string,
  entryTags: TimeEntryTagRef[],
): Promise<void> {
  await ctx.db.client
    .delete(timeEntryTags)
    .where(
      and(eq(timeEntryTags.workspaceId, ctx.workspaceId), eq(timeEntryTags.timeEntryId, entryId)),
    );
  if (entryTags.length === 0) {
    return;
  }
  await ctx.db.client.insert(timeEntryTags).values(
    entryTags.map((tag) => ({
      workspaceId: ctx.workspaceId,
      timeEntryId: entryId,
      tagId: tag.id,
    })),
  );
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
  const entry = rows[0];
  if (!entry) {
    return null;
  }
  const byEntry = await hydrateTagsForEntries(ctx, [entry.id]);
  return toTimeEntryDto(entry, byEntry.get(entry.id) ?? []);
}

export async function startTimer(
  ctx: AuthorizedContext,
  input: StartTimerInput,
  requestId: string,
): Promise<TimeEntryDto> {
  const assignment = await resolveAssignment(ctx, input.projectId, input.taskId, requestId);
  const entryTags = await resolveActiveTags(ctx, input.tagIds ?? [], requestId);
  const now = new Date();
  await assertWeekEditable(ctx, calendarDateInTimezone(now, input.timezone), requestId);
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
        startAt: now,
        workDate: calendarDateInTimezone(now, input.timezone),
        timezone: input.timezone,
      })
      .returning();
    const entry = rows[0];
    if (!entry) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to start timer', requestId);
    }
    if (input.tagIds !== undefined) {
      await replaceEntryTags(ctx, entry.id, entryTags);
    }
    await recordAudit(ctx, requestId, {
      action: 'time_entry.started',
      entityType: 'time_entry',
      entityId: entry.id,
      after: entry,
    });
    const startedDto = toTimeEntryDto(entry, input.tagIds !== undefined ? entryTags : []);
    await emitWebhookEvent(ctx, 'timer.started', { timeEntry: startedDto });
    return startedDto;
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

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
    await recordAudit(ctx, requestId, {
      action: 'time_entry.stopped',
      entityType: 'time_entry',
      entityId: entry.id,
      before,
      after: entry,
    });
    const byEntry = await hydrateTagsForEntries(ctx, [entry.id]);
    const stoppedDto = toTimeEntryDto(entry, byEntry.get(entry.id) ?? []);
    await emitWebhookEvent(ctx, 'timer.stopped', { timeEntry: stoppedDto });
    return stoppedDto;
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

export async function addManualTime(
  ctx: AuthorizedContext,
  input: AddManualTimeInput,
  requestId: string,
): Promise<TimeEntryDto> {
  const assignment = await resolveAssignment(ctx, input.projectId, input.taskId, requestId);
  const entryTags = await resolveActiveTags(ctx, input.tagIds ?? [], requestId);
  const interval = input.kind === 'interval';
  const startAt = interval ? new Date(input.startAt) : null;
  const endAt = interval ? new Date(input.endAt) : null;
  if (startAt && endAt && endAt <= startAt) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'End time must be after start time', requestId);
  }
  const workDate = interval
    ? calendarDateInTimezone(startAt ?? new Date(), input.timezone)
    : (input.workDate ?? calendarDateInTimezone(new Date(), input.timezone));
  await assertWeekEditable(ctx, workDate, requestId);

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
        workDate,
        timezone: input.timezone,
      })
      .returning();
    const entry = rows[0];
    if (!entry) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to add time entry', requestId);
    }
    if (input.tagIds !== undefined) {
      await replaceEntryTags(ctx, entry.id, entryTags);
    }
    await recordAudit(ctx, requestId, {
      action: 'time_entry.created',
      entityType: 'time_entry',
      entityId: entry.id,
      after: entry,
    });
    const createdDto = toTimeEntryDto(entry, input.tagIds !== undefined ? entryTags : []);
    await emitWebhookEvent(ctx, 'time_entry.created', { timeEntry: createdDto });
    return createdDto;
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

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
  const byEntry = await hydrateTagsForEntries(
    ctx,
    page.map((row) => row.id),
  );
  return {
    items: page.map((row) => toTimeEntryDto(row, byEntry.get(row.id) ?? [])),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function updateTimeEntry(
  ctx: AuthorizedContext,
  entryId: string,
  input: UpdateTimeEntryInput,
  requestId: string,
): Promise<TimeEntryDto> {
  const before = await getOwnedEntry(ctx, entryId, requestId);
  if (before.lockedAt) throw locked(requestId);
  await assertEntryWeekEditable(ctx, before.workDate, requestId);
  if (Object.keys(input).length === 0) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'At least one field is required', requestId);
  }

  const assignment = await resolveAssignment(
    ctx,
    input.projectId === undefined ? before.projectId : input.projectId,
    input.taskId === undefined ? before.taskId : input.taskId,
    requestId,
  );
  const entryTags =
    input.tagIds === undefined ? null : await resolveActiveTags(ctx, input.tagIds, requestId);
  const nextStartAt = input.startAt === undefined ? before.startAt : new Date(input.startAt);
  const nextEndAt =
    input.endAt === undefined ? before.endAt : input.endAt === null ? null : new Date(input.endAt);
  const nextDuration =
    input.durationMinutes === undefined ? before.durationMinutes : input.durationMinutes;
  const nextTimezone = input.timezone ?? before.timezone;
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
        workDate:
          input.workDate ??
          (nextStartAt && (input.startAt !== undefined || input.timezone !== undefined)
            ? calendarDateInTimezone(nextStartAt, nextTimezone)
            : before.workDate),
        timezone: nextTimezone,
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
    if (entryTags) {
      await replaceEntryTags(ctx, entry.id, entryTags);
    }
    await recordAudit(ctx, requestId, {
      action: 'time_entry.updated',
      entityType: 'time_entry',
      entityId: entry.id,
      before,
      after: entry,
    });
    if (entryTags) {
      return toTimeEntryDto(entry, entryTags);
    }
    const byEntry = await hydrateTagsForEntries(ctx, [entry.id]);
    return toTimeEntryDto(entry, byEntry.get(entry.id) ?? []);
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

function entryMinutes(entry: TimeEntry, now: Date): number {
  if (entry.durationMinutes !== null) return entry.durationMinutes;
  if (!entry.startAt) return 0;
  const endAt = entry.endAt ?? now;
  return Math.max(0, Math.round((endAt.getTime() - entry.startAt.getTime()) / 60_000));
}

export async function getWeeklyTimeSummary(
  ctx: AuthorizedContext,
  query: WeeklyTimeQuery,
): Promise<WeeklyTimeSummary> {
  const weekEnd = addCalendarDays(query.weekStart, 6);
  const rows = await ctx.db.client
    .select()
    .from(timeEntries)
    .where(weeklyTimeScope(ctx.workspaceId, ctx.userId, query.weekStart, weekEnd))
    .orderBy(asc(timeEntries.workDate), asc(timeEntries.id));

  const byEntry = await hydrateTagsForEntries(
    ctx,
    rows.map((row) => row.id),
  );
  return buildWeeklyTimeSummary(rows, query, new Date(), byEntry);
}

export function buildWeeklyTimeSummary(
  rows: TimeEntry[],
  query: WeeklyTimeQuery,
  now: Date,
  tagsByEntryId: TagsByEntryId = new Map(),
): WeeklyTimeSummary {
  const weekEnd = addCalendarDays(query.weekStart, 6);
  const dates = Array.from({ length: 7 }, (_value, index) =>
    addCalendarDays(query.weekStart, index),
  );
  const dayIndex = new Map<string, number>();
  for (const [index, date] of dates.entries()) dayIndex.set(date, index);
  const dailyMinutes = Array.from({ length: 7 }, () => 0);
  const grouped = new Map<
    string,
    { projectId: string | null; entries: TimeEntryDto[]; dailyMinutes: number[] }
  >();
  for (const row of rows) {
    const index = dayIndex.get(row.workDate);
    if (index === undefined) continue;
    const minutes = entryMinutes(row, now);
    dailyMinutes[index] = (dailyMinutes[index] ?? 0) + minutes;
    const key = row.projectId ?? '';
    let project = grouped.get(key);
    if (!project) {
      project = {
        projectId: row.projectId,
        entries: [],
        dailyMinutes: Array.from({ length: 7 }, () => 0),
      };
      grouped.set(key, project);
    }
    project.entries.push(toTimeEntryDto(row, tagsByEntryId.get(row.id) ?? []));
    project.dailyMinutes[index] = (project.dailyMinutes[index] ?? 0) + minutes;
  }

  const days = dates.map((date, index) => {
    const totalMinutes = dailyMinutes[index] ?? 0;
    const expectedMinutes = index < 5 ? 480 : 0;
    return {
      date,
      totalMinutes,
      expectedMinutes,
      missingMinutes: Math.max(0, expectedMinutes - totalMinutes),
    };
  });
  const projectSummaries: WeeklyTimeSummary['projects'] = [];
  for (const project of grouped.values()) {
    let projectTotal = 0;
    for (const minutes of project.dailyMinutes) projectTotal += minutes;
    projectSummaries.push({
      projectId: project.projectId,
      entries: project.entries,
      dailyMinutes: project.dailyMinutes,
      totalMinutes: projectTotal,
    });
  }
  const totalMinutes = dailyMinutes.reduce((total, minutes) => total + minutes, 0);
  const expectedMinutes = days.reduce((total, day) => total + day.expectedMinutes, 0);
  return {
    weekStart: query.weekStart,
    weekEnd,
    timezone: query.timezone,
    days,
    projects: projectSummaries,
    totalMinutes,
    expectedMinutes,
    missingMinutes: Math.max(0, expectedMinutes - totalMinutes),
  };
}

export async function copyPreviousWeek(
  ctx: AuthorizedContext,
  query: WeeklyTimeQuery,
  requestId: string,
): Promise<{ copiedEntries: number }> {
  const targetEnd = addCalendarDays(query.weekStart, 6);
  const existing = await ctx.db.client
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, ctx.workspaceId),
        eq(timeEntries.userId, ctx.userId),
        gte(timeEntries.workDate, query.weekStart),
        lte(timeEntries.workDate, targetEnd),
      ),
    )
    .limit(1);
  if (existing[0]) {
    throw toApiError(
      ERROR_CODES.CONFLICT,
      'The selected week already contains time entries',
      requestId,
    );
  }
  await assertWeekEditable(ctx, query.weekStart, requestId);

  const sourceStart = addCalendarDays(query.weekStart, -7);
  const sourceEnd = addCalendarDays(query.weekStart, -1);
  const rows = await ctx.db.client
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, ctx.workspaceId),
        eq(timeEntries.userId, ctx.userId),
        gte(timeEntries.workDate, sourceStart),
        lte(timeEntries.workDate, sourceEnd),
      ),
    )
    .orderBy(asc(timeEntries.workDate), asc(timeEntries.id));
  const now = new Date();
  const completed = rows.filter(
    (entry) =>
      (entry.durationMinutes !== null || entry.endAt !== null) && entryMinutes(entry, now) > 0,
  );
  if (completed.length === 0) return { copiedEntries: 0 };
  const sourceTags = await hydrateTagsForEntries(
    ctx,
    completed.map((entry) => entry.id),
  );
  const inserted = await ctx.db.client
    .insert(timeEntries)
    .values(
      completed.map((entry) => ({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        projectId: entry.projectId,
        taskId: entry.taskId,
        description: entry.description,
        billable: entry.billable,
        durationMinutes: entryMinutes(entry, now),
        workDate: addCalendarDays(entry.workDate, 7),
        timezone: query.timezone,
      })),
    )
    .returning();
  const tagLinks: Promise<void>[] = [];
  for (const [index, entry] of inserted.entries()) {
    const source = completed[index];
    if (!source) continue;
    const entryTags = sourceTags.get(source.id) ?? [];
    if (entryTags.length > 0) {
      tagLinks.push(replaceEntryTags(ctx, entry.id, entryTags));
    }
  }
  await Promise.all(tagLinks);
  await Promise.all(
    inserted.map((entry) =>
      recordAudit(ctx, requestId, {
        action: 'time_entry.created',
        entityType: 'time_entry',
        entityId: entry.id,
        after: entry,
      }),
    ),
  );
  return { copiedEntries: inserted.length };
}

export async function duplicateTimeEntry(
  ctx: AuthorizedContext,
  entryId: string,
  requestId: string,
): Promise<TimeEntryDto> {
  const source = await getOwnedEntry(ctx, entryId, requestId);
  if (source.lockedAt) throw locked(requestId);
  await assertEntryWeekEditable(ctx, source.workDate, requestId);
  if (source.startAt !== null && source.endAt === null) {
    throw toApiError(ERROR_CODES.CONFLICT, 'Stop the timer before duplicating it', requestId);
  }

  const minutes = entryMinutes(source, new Date());
  if (minutes <= 0) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Time entry has no duration to duplicate', requestId);
  }

  const sourceTags = await hydrateTagsForEntries(ctx, [source.id]);
  try {
    const inserted = await ctx.db.client
      .insert(timeEntries)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        projectId: source.projectId,
        taskId: source.taskId,
        description: source.description,
        billable: source.billable,
        durationMinutes: minutes,
        workDate: source.workDate,
        timezone: source.timezone,
      })
      .returning();
    const entry = inserted[0];
    if (!entry) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to duplicate time entry', requestId);
    }
    const entryTags = sourceTags.get(source.id) ?? [];
    if (entryTags.length > 0) {
      await replaceEntryTags(ctx, entry.id, entryTags);
    }
    await recordAudit(ctx, requestId, {
      action: 'time_entry.created',
      entityType: 'time_entry',
      entityId: entry.id,
      after: entry,
    });
    return toTimeEntryDto(entry, entryTags);
  } catch (error) {
    return mapConstraintError(error, requestId);
  }
}

export async function removeTimeEntry(
  ctx: AuthorizedContext,
  entryId: string,
  requestId: string,
): Promise<void> {
  const before = await getOwnedEntry(ctx, entryId, requestId);
  if (before.lockedAt) throw locked(requestId);
  await assertEntryWeekEditable(ctx, before.workDate, requestId);
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
  await recordAudit(ctx, requestId, {
    action: 'time_entry.deleted',
    entityType: 'time_entry',
    entityId: entryId,
    before,
  });
}
