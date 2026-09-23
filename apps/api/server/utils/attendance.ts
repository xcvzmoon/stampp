import type { AuthorizedContext } from '@stampp/access';
import type { AttendanceRecord } from '@stampp/database';
import type {
  AttendanceDto,
  AttendanceListQuery,
  ClockInInput,
  ClockOutInput,
  CreateAttendanceInput,
  CurrentAttendance,
  UpdateAttendanceInput,
} from '@stampp/shared';
import { attendanceRecords, members } from '@stampp/database';
import {
  assertValidAttendanceInterval,
  attendanceDurationMinutes,
  attendanceState,
  canClockIn,
  canClockOut,
  hasPermission,
} from '@stampp/domain';
import { DEFAULT_LIST_LIMIT, ERROR_CODES, attendanceListQuerySchema } from '@stampp/shared';
import { and, asc, eq, gt, gte, isNull, lte, type SQL } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { isUniqueViolation } from '~/server/utils/catalog.ts';
import { calendarDateInTimezone } from '~/server/utils/week.ts';

type ListAttendanceOptions = AttendanceListQuery & { limit: number };

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Attendance record not found', requestId);
}

function alreadyOpen(requestId: string) {
  return toApiError(ERROR_CODES.ATTENDANCE_ALREADY_OPEN, 'You are already clocked in', requestId);
}

function notOpen(requestId: string) {
  return toApiError(ERROR_CODES.ATTENDANCE_NOT_OPEN, 'You are not clocked in', requestId);
}

function invalidInterval(requestId: string, message: string) {
  return toApiError(ERROR_CODES.ATTENDANCE_INVALID_INTERVAL, message, requestId);
}

export function toAttendanceDto(row: AttendanceRecord, now: Date = new Date()): AttendanceDto {
  const state = attendanceState(row.clockOutAt);
  const durationMinutes =
    row.durationMinutes ??
    (state === 'open' ? attendanceDurationMinutes(row.clockInAt, null, now) : null);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt?.toISOString() ?? null,
    durationMinutes,
    workDate: row.workDate,
    timezone: row.timezone,
    source: row.source,
    note: row.note,
    state,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOpenRecord(
  ctx: AuthorizedContext,
  userId: string,
): Promise<AttendanceRecord | null> {
  const rows = await ctx.db.client
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workspaceId, ctx.workspaceId),
        eq(attendanceRecords.userId, userId),
        isNull(attendanceRecords.clockOutAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function getRecordRow(
  ctx: AuthorizedContext,
  recordId: string,
  requestId: string,
): Promise<AttendanceRecord> {
  const rows = await ctx.db.client
    .select()
    .from(attendanceRecords)
    .where(
      and(eq(attendanceRecords.workspaceId, ctx.workspaceId), eq(attendanceRecords.id, recordId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

function assertCanEditRecord(
  ctx: AuthorizedContext,
  row: AttendanceRecord,
  requestId: string,
): void {
  if (row.userId === ctx.userId) {
    if (!hasPermission(ctx.role, 'attendance:write:own')) {
      throw toApiError(ERROR_CODES.FORBIDDEN, 'You cannot edit attendance', requestId);
    }
    return;
  }
  if (!hasPermission(ctx.role, 'attendance:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You cannot edit other members attendance', requestId);
  }
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

export async function getCurrentAttendance(
  ctx: AuthorizedContext,
  now: Date = new Date(),
): Promise<CurrentAttendance> {
  const open = await getOpenRecord(ctx, ctx.userId);
  if (!open) {
    return { clockedIn: false, record: null, elapsedMinutes: null };
  }
  const dto = toAttendanceDto(open, now);
  return {
    clockedIn: true,
    record: dto,
    elapsedMinutes: dto.durationMinutes,
  };
}

export async function clockIn(
  ctx: AuthorizedContext,
  input: ClockInInput,
  requestId: string,
): Promise<AttendanceDto> {
  const existing = await getOpenRecord(ctx, ctx.userId);
  if (!canClockIn(existing !== null)) throw alreadyOpen(requestId);

  const now = new Date();
  try {
    const rows = await ctx.db.client
      .insert(attendanceRecords)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        clockInAt: now,
        workDate: calendarDateInTimezone(now, input.timezone),
        timezone: input.timezone,
        source: 'clock',
        note: input.note ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to clock in', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'attendance.clocked_in',
      entityType: 'attendance_record',
      entityId: row.id,
      after: row,
    });
    return toAttendanceDto(row, now);
  } catch (error) {
    if (isUniqueViolation(error)) throw alreadyOpen(requestId);
    throw error;
  }
}

export async function clockOut(
  ctx: AuthorizedContext,
  input: ClockOutInput,
  requestId: string,
): Promise<AttendanceDto> {
  const open = await getOpenRecord(ctx, ctx.userId);
  if (!canClockOut(open !== null) || !open) throw notOpen(requestId);

  const now = new Date();
  try {
    assertValidAttendanceInterval(open.clockInAt, now);
    const durationMinutes = attendanceDurationMinutes(open.clockInAt, now);
    const rows = await ctx.db.client
      .update(attendanceRecords)
      .set({
        clockOutAt: now,
        durationMinutes,
        note: input.note ?? open.note,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendanceRecords.id, open.id),
          eq(attendanceRecords.workspaceId, ctx.workspaceId),
          isNull(attendanceRecords.clockOutAt),
        ),
      )
      .returning();
    const row = rows[0];
    if (!row) throw notOpen(requestId);
    await recordAudit(ctx, requestId, {
      action: 'attendance.clocked_out',
      entityType: 'attendance_record',
      entityId: row.id,
      before: open,
      after: row,
    });
    return toAttendanceDto(row, now);
  } catch (error) {
    if (error instanceof RangeError) {
      throw invalidInterval(requestId, error.message);
    }
    throw error;
  }
}

export async function createAttendance(
  ctx: AuthorizedContext,
  input: CreateAttendanceInput,
  requestId: string,
): Promise<AttendanceDto> {
  if (!hasPermission(ctx.role, 'attendance:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Attendance manage permission is required', requestId);
  }
  const targetUserId = input.userId ?? ctx.userId;
  await assertWorkspaceMember(ctx, targetUserId, requestId);

  const clockInAt = new Date(input.clockInAt);
  const clockOutAt = input.clockOutAt ? new Date(input.clockOutAt) : null;
  try {
    assertValidAttendanceInterval(clockInAt, clockOutAt);
  } catch (error) {
    if (error instanceof RangeError) throw invalidInterval(requestId, error.message);
    throw error;
  }

  if (clockOutAt === null) {
    const open = await getOpenRecord(ctx, targetUserId);
    if (open) throw alreadyOpen(requestId);
  }

  const durationMinutes =
    clockOutAt === null ? null : attendanceDurationMinutes(clockInAt, clockOutAt);

  try {
    const rows = await ctx.db.client
      .insert(attendanceRecords)
      .values({
        workspaceId: ctx.workspaceId,
        userId: targetUserId,
        clockInAt,
        clockOutAt,
        durationMinutes,
        workDate: calendarDateInTimezone(clockInAt, input.timezone),
        timezone: input.timezone,
        source: 'manual',
        note: input.note ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create attendance record', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'attendance.created',
      entityType: 'attendance_record',
      entityId: row.id,
      after: row,
    });
    return toAttendanceDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw alreadyOpen(requestId);
    throw error;
  }
}

export async function updateAttendance(
  ctx: AuthorizedContext,
  recordId: string,
  input: UpdateAttendanceInput,
  requestId: string,
): Promise<AttendanceDto> {
  const before = await getRecordRow(ctx, recordId, requestId);
  assertCanEditRecord(ctx, before, requestId);

  const clockInAt = input.clockInAt ? new Date(input.clockInAt) : before.clockInAt;
  const nextClockOutAt =
    input.clockOutAt === undefined
      ? before.clockOutAt
      : input.clockOutAt
        ? new Date(input.clockOutAt)
        : null;
  const timezone = input.timezone ?? before.timezone;

  try {
    assertValidAttendanceInterval(clockInAt, nextClockOutAt);
  } catch (error) {
    if (error instanceof RangeError) throw invalidInterval(requestId, error.message);
    throw error;
  }

  if (nextClockOutAt === null && before.clockOutAt !== null) {
    const open = await getOpenRecord(ctx, before.userId);
    if (open && open.id !== before.id) throw alreadyOpen(requestId);
  }

  const durationMinutes =
    nextClockOutAt === null ? null : attendanceDurationMinutes(clockInAt, nextClockOutAt);
  const workDate = calendarDateInTimezone(clockInAt, timezone);
  const note = input.note === undefined ? before.note : input.note;

  const rows = await ctx.db.client
    .update(attendanceRecords)
    .set({
      clockInAt,
      clockOutAt: nextClockOutAt,
      durationMinutes,
      timezone,
      workDate,
      note,
      updatedAt: new Date(),
    })
    .where(
      and(eq(attendanceRecords.id, before.id), eq(attendanceRecords.workspaceId, ctx.workspaceId)),
    )
    .returning();
  const row = rows[0];
  if (!row) throw notFound(requestId);

  await recordAudit(ctx, requestId, {
    action: 'attendance.updated',
    entityType: 'attendance_record',
    entityId: row.id,
    before,
    after: row,
  });
  return toAttendanceDto(row);
}

export async function deleteAttendance(
  ctx: AuthorizedContext,
  recordId: string,
  requestId: string,
): Promise<void> {
  if (!hasPermission(ctx.role, 'attendance:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Attendance manage permission is required', requestId);
  }
  const before = await getRecordRow(ctx, recordId, requestId);
  await ctx.db.client
    .delete(attendanceRecords)
    .where(
      and(eq(attendanceRecords.id, before.id), eq(attendanceRecords.workspaceId, ctx.workspaceId)),
    );
  await recordAudit(ctx, requestId, {
    action: 'attendance.deleted',
    entityType: 'attendance_record',
    entityId: before.id,
    before,
  });
}

export async function listAttendance(
  ctx: AuthorizedContext,
  options: ListAttendanceOptions,
): Promise<{ items: AttendanceDto[]; nextCursor: string | null }> {
  const conditions: SQL[] = [eq(attendanceRecords.workspaceId, ctx.workspaceId)];
  const canReadAny = hasPermission(ctx.role, 'attendance:read:any');
  if (!canReadAny) {
    conditions.push(eq(attendanceRecords.userId, ctx.userId));
  } else if (options.userId) {
    conditions.push(eq(attendanceRecords.userId, options.userId));
  }
  if (options.cursor) conditions.push(gt(attendanceRecords.id, options.cursor));
  if (options.from) conditions.push(gte(attendanceRecords.workDate, options.from));
  if (options.to) conditions.push(lte(attendanceRecords.workDate, options.to));

  const rows = await ctx.db.client
    .select()
    .from(attendanceRecords)
    .where(and(...conditions))
    .orderBy(asc(attendanceRecords.id))
    .limit(options.limit + 1);

  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => toAttendanceDto(row)),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export function parseAttendanceListQuery(
  query: URLSearchParams,
  requestId: string,
): ListAttendanceOptions {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'userId', 'from', 'to']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(attendanceListQuerySchema, raw);
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
