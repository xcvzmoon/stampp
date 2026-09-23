import type { AuthorizedContext } from '@stampp/access';
import type { Holiday, TimeOffRequest, TimeOffType } from '@stampp/database';
import type { TimeOffAction } from '@stampp/domain';
import type {
  CreateHolidayInput,
  CreateTimeOffRequestInput,
  CreateTimeOffTypeInput,
  DecideTimeOffInput,
  HolidayDto,
  HolidayListResult,
  TimeOffBalanceListResult,
  TimeOffCalendarResult,
  TimeOffListQuery,
  TimeOffRequestDto,
  TimeOffRequestListResult,
  TimeOffStatus,
  TimeOffTypeDto,
  TimeOffTypeListResult,
  UpdateTimeOffTypeInput,
} from '@stampp/shared';
import { holidays, timeOffRequests, timeOffTypes } from '@stampp/database';
import {
  canTransitionTimeOff,
  countTimeOffDays,
  countsTowardBalance,
  hasPermission,
  hasSufficientBalance,
  isValidTimeOffRange,
  nextTimeOffStatus,
  resolveTimeOffBalance,
} from '@stampp/domain';
import { DEFAULT_LIST_LIMIT, ERROR_CODES, timeOffListQuerySchema } from '@stampp/shared';
import { and, asc, desc, eq, gt, gte, inArray, lte, type SQL } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import {
  cancelApprovalRun,
  decideApprovalRun,
  getPendingRunForEntity,
  startApprovalRun,
} from '~/server/utils/approvalChains.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { isUniqueViolation } from '~/server/utils/catalog.ts';
import { emitWebhookEvent } from '~/server/utils/webhookEvents.ts';

type ListRequestOptions = TimeOffListQuery & { limit: number };

function notFound(requestId: string, entity: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, `${entity} not found`, requestId);
}

function invalidTransition(requestId: string, message: string) {
  return toApiError(ERROR_CODES.TIME_OFF_INVALID_TRANSITION, message, requestId);
}

function invalidRange(requestId: string, message: string) {
  return toApiError(ERROR_CODES.TIME_OFF_INVALID_RANGE, message, requestId);
}

function parseAllowance(value: string | null): number | null {
  if (value === null) return null;
  return Number(value);
}

export function toTimeOffTypeDto(row: TimeOffType): TimeOffTypeDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    color: row.color,
    paid: row.paid,
    annualAllowanceDays: parseAllowance(row.annualAllowanceDays),
    requiresApproval: row.requiresApproval,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toHolidayDto(row: Holiday): HolidayDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    date: row.date,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTimeOffRequestDto(row: TimeOffRequest): TimeOffRequestDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    timeOffTypeId: row.timeOffTypeId,
    startDate: row.startDate,
    endDate: row.endDate,
    days: Number(row.days),
    status: row.status,
    note: row.note,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTimeOffTypes(
  ctx: AuthorizedContext,
  options: { limit: number; cursor?: string; activeOnly?: boolean },
): Promise<TimeOffTypeListResult> {
  const conditions: SQL[] = [eq(timeOffTypes.workspaceId, ctx.workspaceId)];
  if (options.cursor) conditions.push(gt(timeOffTypes.id, options.cursor));
  if (options.activeOnly) conditions.push(eq(timeOffTypes.active, true));
  const rows = await ctx.db.client
    .select()
    .from(timeOffTypes)
    .where(and(...conditions))
    .orderBy(asc(timeOffTypes.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toTimeOffTypeDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function createTimeOffType(
  ctx: AuthorizedContext,
  input: CreateTimeOffTypeInput,
  requestId: string,
): Promise<TimeOffTypeDto> {
  try {
    const rows = await ctx.db.client
      .insert(timeOffTypes)
      .values({
        workspaceId: ctx.workspaceId,
        name: input.name,
        color: input.color ?? null,
        paid: input.paid ?? true,
        annualAllowanceDays:
          input.annualAllowanceDays === null || input.annualAllowanceDays === undefined
            ? null
            : String(input.annualAllowanceDays),
        requiresApproval: input.requiresApproval ?? true,
        active: input.active ?? true,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create time-off type', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'time_off_type.created',
      entityType: 'time_off_type',
      entityId: row.id,
      after: row,
    });
    return toTimeOffTypeDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(
        ERROR_CODES.CONFLICT,
        'A time-off type with that name already exists',
        requestId,
      );
    }
    throw error;
  }
}

export async function updateTimeOffType(
  ctx: AuthorizedContext,
  typeId: string,
  input: UpdateTimeOffTypeInput,
  requestId: string,
): Promise<TimeOffTypeDto> {
  const before = await getTimeOffTypeRow(ctx, typeId, requestId);
  try {
    const rows = await ctx.db.client
      .update(timeOffTypes)
      .set({
        name: input.name ?? before.name,
        color: input.color === undefined ? before.color : input.color,
        paid: input.paid ?? before.paid,
        annualAllowanceDays:
          input.annualAllowanceDays === undefined
            ? before.annualAllowanceDays
            : input.annualAllowanceDays === null
              ? null
              : String(input.annualAllowanceDays),
        requiresApproval: input.requiresApproval ?? before.requiresApproval,
        active: input.active ?? before.active,
        updatedAt: new Date(),
      })
      .where(and(eq(timeOffTypes.id, before.id), eq(timeOffTypes.workspaceId, ctx.workspaceId)))
      .returning();
    const row = rows[0];
    if (!row) throw notFound(requestId, 'Time-off type');
    await recordAudit(ctx, requestId, {
      action: 'time_off_type.updated',
      entityType: 'time_off_type',
      entityId: row.id,
      before,
      after: row,
    });
    return toTimeOffTypeDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(
        ERROR_CODES.CONFLICT,
        'A time-off type with that name already exists',
        requestId,
      );
    }
    throw error;
  }
}

async function getTimeOffTypeRow(
  ctx: AuthorizedContext,
  typeId: string,
  requestId: string,
): Promise<TimeOffType> {
  const rows = await ctx.db.client
    .select()
    .from(timeOffTypes)
    .where(and(eq(timeOffTypes.id, typeId), eq(timeOffTypes.workspaceId, ctx.workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Time-off type');
  return row;
}

export async function deleteTimeOffType(
  ctx: AuthorizedContext,
  typeId: string,
  requestId: string,
): Promise<void> {
  const before = await getTimeOffTypeRow(ctx, typeId, requestId);
  try {
    await ctx.db.client
      .delete(timeOffTypes)
      .where(and(eq(timeOffTypes.id, before.id), eq(timeOffTypes.workspaceId, ctx.workspaceId)));
  } catch (error) {
    if (isUniqueViolation(error) || isForeignKeyViolation(error)) {
      // Soft-deactivate instead of hard delete when history exists.
      await ctx.db.client
        .update(timeOffTypes)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(timeOffTypes.id, before.id));
      await recordAudit(ctx, requestId, {
        action: 'time_off_type.deactivated',
        entityType: 'time_off_type',
        entityId: before.id,
        before,
      });
      return;
    }
    throw error;
  }
  await recordAudit(ctx, requestId, {
    action: 'time_off_type.deleted',
    entityType: 'time_off_type',
    entityId: before.id,
    before,
  });
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Postgres catch-boundary classifier
function isForeignKeyViolation(error: unknown): boolean {
  const result = v.safeParse(v.object({ code: v.optional(v.string()) }), error);
  return result.success && result.output.code === '23503';
}

export async function listHolidays(
  ctx: AuthorizedContext,
  options: { limit: number; cursor?: string; from?: string; to?: string },
): Promise<HolidayListResult> {
  const conditions: SQL[] = [eq(holidays.workspaceId, ctx.workspaceId)];
  if (options.cursor) conditions.push(gt(holidays.id, options.cursor));
  if (options.from) conditions.push(gte(holidays.date, options.from));
  if (options.to) conditions.push(lte(holidays.date, options.to));
  const rows = await ctx.db.client
    .select()
    .from(holidays)
    .where(and(...conditions))
    .orderBy(asc(holidays.date), asc(holidays.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toHolidayDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function createHoliday(
  ctx: AuthorizedContext,
  input: CreateHolidayInput,
  requestId: string,
): Promise<HolidayDto> {
  try {
    const rows = await ctx.db.client
      .insert(holidays)
      .values({
        workspaceId: ctx.workspaceId,
        name: input.name,
        date: input.date,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create holiday', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'holiday.created',
      entityType: 'holiday',
      entityId: row.id,
      after: row,
    });
    return toHolidayDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(ERROR_CODES.CONFLICT, 'That holiday already exists for the date', requestId);
    }
    throw error;
  }
}

async function getHolidayRow(
  ctx: AuthorizedContext,
  holidayId: string,
  requestId: string,
): Promise<Holiday> {
  const rows = await ctx.db.client
    .select()
    .from(holidays)
    .where(and(eq(holidays.id, holidayId), eq(holidays.workspaceId, ctx.workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Holiday');
  return row;
}

export async function deleteHoliday(
  ctx: AuthorizedContext,
  holidayId: string,
  requestId: string,
): Promise<void> {
  const before = await getHolidayRow(ctx, holidayId, requestId);
  await ctx.db.client
    .delete(holidays)
    .where(and(eq(holidays.id, before.id), eq(holidays.workspaceId, ctx.workspaceId)));
  await recordAudit(ctx, requestId, {
    action: 'holiday.deleted',
    entityType: 'holiday',
    entityId: before.id,
    before,
  });
}

async function loadHolidayDates(
  ctx: AuthorizedContext,
  from?: string,
  to?: string,
): Promise<Set<string>> {
  const conditions: SQL[] = [eq(holidays.workspaceId, ctx.workspaceId)];
  if (from) conditions.push(gte(holidays.date, from));
  if (to) conditions.push(lte(holidays.date, to));
  const rows = await ctx.db.client
    .select({ date: holidays.date })
    .from(holidays)
    .where(and(...conditions));
  return new Set(rows.map((row) => row.date));
}

async function getTypeRow(
  ctx: AuthorizedContext,
  typeId: string,
  requestId: string,
): Promise<TimeOffType> {
  return getTimeOffTypeRow(ctx, typeId, requestId);
}

export async function createTimeOffRequest(
  ctx: AuthorizedContext,
  input: CreateTimeOffRequestInput,
  requestId: string,
): Promise<TimeOffRequestDto> {
  if (!isValidTimeOffRange(input.startDate, input.endDate)) {
    throw invalidRange(requestId, 'endDate must be on or after startDate');
  }
  const type = await getTypeRow(ctx, input.timeOffTypeId, requestId);
  if (!type.active) {
    throw toApiError(ERROR_CODES.TIME_OFF_TYPE_INACTIVE, 'Time-off type is inactive', requestId);
  }

  const holidayDates = await loadHolidayDates(ctx, input.startDate, input.endDate);
  let days: number;
  try {
    days = countTimeOffDays(input.startDate, input.endDate, holidayDates);
  } catch (error) {
    if (error instanceof RangeError) throw invalidRange(requestId, error.message);
    throw error;
  }
  if (days <= 0) {
    throw invalidRange(requestId, 'Request covers no working days');
  }

  if (type.annualAllowanceDays !== null) {
    const balance = await getTimeOffBalanceForType(
      ctx,
      type,
      ctx.userId,
      input.startDate.slice(0, 4),
    );
    if (!hasSufficientBalance(balance, days)) {
      throw toApiError(
        ERROR_CODES.TIME_OFF_INSUFFICIENT_BALANCE,
        'Not enough time-off balance for this range',
        requestId,
      );
    }
  }

  const overlap = await ctx.db.client
    .select({ id: timeOffRequests.id })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.workspaceId, ctx.workspaceId),
        eq(timeOffRequests.userId, ctx.userId),
        eq(timeOffRequests.status, 'pending'),
        lte(timeOffRequests.startDate, input.endDate),
        gte(timeOffRequests.endDate, input.startDate),
      ),
    )
    .limit(1);
  if (overlap[0]) {
    throw toApiError(
      ERROR_CODES.TIME_OFF_OVERLAP,
      'Overlaps an existing pending request',
      requestId,
    );
  }

  try {
    const rows = await ctx.db.client
      .insert(timeOffRequests)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        timeOffTypeId: type.id,
        startDate: input.startDate,
        endDate: input.endDate,
        days: String(days),
        status: 'pending',
        note: input.note ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create time-off request', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'time_off_request.created',
      entityType: 'time_off_request',
      entityId: row.id,
      after: row,
    });
    await emitWebhookEvent(ctx, 'time_off.requested', { timeOffRequestId: row.id });
    await startApprovalRun(ctx, 'time_off_request', row.id, ctx.userId, requestId);
    return toTimeOffRequestDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Request conflicted with existing data', requestId);
    }
    throw error;
  }
}

async function getRequestRow(
  ctx: AuthorizedContext,
  requestIdRow: string,
  requestId: string,
): Promise<TimeOffRequest> {
  const rows = await ctx.db.client
    .select()
    .from(timeOffRequests)
    .where(
      and(eq(timeOffRequests.id, requestIdRow), eq(timeOffRequests.workspaceId, ctx.workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Time-off request');
  return row;
}

async function decideTimeOff(
  ctx: AuthorizedContext,
  requestIdRow: string,
  action: Extract<TimeOffAction, 'approve' | 'reject'>,
  input: DecideTimeOffInput,
  requestId: string,
): Promise<TimeOffRequestDto> {
  const before = await getRequestRow(ctx, requestIdRow, requestId);
  if (!canTransitionTimeOff(action, before.status)) {
    throw invalidTransition(requestId, `Cannot ${action} a request that is ${before.status}`);
  }
  if (action === 'reject' && !input.note) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Rejection requires a note', requestId);
  }
  if (action === 'approve' && before.userId === ctx.userId) {
    throw toApiError(
      ERROR_CODES.FORBIDDEN,
      'You cannot approve your own time-off request',
      requestId,
    );
  }

  const pendingRun = await getPendingRunForEntity(ctx, 'time_off_request', before.id);
  if (pendingRun) {
    const { isFinalStep } = await decideApprovalRun(
      ctx,
      pendingRun.id,
      { action, note: input.note },
      requestId,
    );
    if (action === 'approve' && !isFinalStep) {
      await recordAudit(ctx, requestId, {
        action: 'time_off_request.chain_step',
        entityType: 'time_off_request',
        entityId: before.id,
        before,
        after: { approvalRunId: pendingRun.id, currentStepPending: true },
      });
      return toTimeOffRequestDto(before);
    }
  }

  const now = new Date();
  const rows = await ctx.db.client
    .update(timeOffRequests)
    .set({
      status: nextTimeOffStatus(action),
      decidedAt: now,
      decidedBy: ctx.userId,
      decisionNote: input.note ?? null,
      updatedAt: now,
    })
    .where(and(eq(timeOffRequests.id, before.id), eq(timeOffRequests.status, before.status)))
    .returning();
  const row = rows[0];
  if (!row) {
    throw toApiError(ERROR_CODES.CONFLICT, 'Time-off request changed concurrently', requestId);
  }
  await recordAudit(ctx, requestId, {
    action: action === 'approve' ? 'time_off_request.approved' : 'time_off_request.rejected',
    entityType: 'time_off_request',
    entityId: row.id,
    before,
    after: row,
  });
  return toTimeOffRequestDto(row);
}

export async function approveTimeOffRequest(
  ctx: AuthorizedContext,
  requestIdRow: string,
  input: DecideTimeOffInput,
  requestId: string,
): Promise<TimeOffRequestDto> {
  return decideTimeOff(ctx, requestIdRow, 'approve', input, requestId);
}

export async function rejectTimeOffRequest(
  ctx: AuthorizedContext,
  requestIdRow: string,
  input: DecideTimeOffInput,
  requestId: string,
): Promise<TimeOffRequestDto> {
  return decideTimeOff(ctx, requestIdRow, 'reject', input, requestId);
}

export async function withdrawTimeOffRequest(
  ctx: AuthorizedContext,
  requestIdRow: string,
  requestId: string,
): Promise<TimeOffRequestDto> {
  const before = await getRequestRow(ctx, requestIdRow, requestId);
  if (before.userId !== ctx.userId) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You can only withdraw your own requests', requestId);
  }
  if (!canTransitionTimeOff('withdraw', before.status)) {
    throw invalidTransition(requestId, `Cannot withdraw a request that is ${before.status}`);
  }
  const now = new Date();
  const rows = await ctx.db.client
    .update(timeOffRequests)
    .set({
      status: nextTimeOffStatus('withdraw'),
      decidedAt: now,
      decidedBy: ctx.userId,
      decisionNote: null,
      updatedAt: now,
    })
    .where(and(eq(timeOffRequests.id, before.id), eq(timeOffRequests.status, before.status)))
    .returning();
  const row = rows[0];
  if (!row) {
    throw toApiError(ERROR_CODES.CONFLICT, 'Time-off request changed concurrently', requestId);
  }
  await cancelApprovalRun(ctx, 'time_off_request', before.id, requestId, 'withdrawn');
  await recordAudit(ctx, requestId, {
    action: 'time_off_request.withdrawn',
    entityType: 'time_off_request',
    entityId: row.id,
    before,
    after: row,
  });
  return toTimeOffRequestDto(row);
}

export async function listTimeOffRequests(
  ctx: AuthorizedContext,
  options: ListRequestOptions,
): Promise<TimeOffRequestListResult> {
  const conditions: SQL[] = [eq(timeOffRequests.workspaceId, ctx.workspaceId)];
  const canReadTeam = hasCanReadTeam(ctx);
  if (!canReadTeam) {
    conditions.push(eq(timeOffRequests.userId, ctx.userId));
  } else if (options.userId) {
    conditions.push(eq(timeOffRequests.userId, options.userId));
  }
  if (options.cursor) conditions.push(gt(timeOffRequests.id, options.cursor));
  if (options.status) conditions.push(eq(timeOffRequests.status, options.status));
  if (options.typeId) conditions.push(eq(timeOffRequests.timeOffTypeId, options.typeId));
  if (options.from) conditions.push(gte(timeOffRequests.endDate, options.from));
  if (options.to) conditions.push(lte(timeOffRequests.startDate, options.to));

  const rows = await ctx.db.client
    .select()
    .from(timeOffRequests)
    .where(and(...conditions))
    .orderBy(desc(timeOffRequests.startDate), asc(timeOffRequests.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toTimeOffRequestDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

function hasCanReadTeam(ctx: AuthorizedContext): boolean {
  return hasPermission(ctx.role, 'timeoff:read:team');
}

export async function listPendingTimeOffRequests(
  ctx: AuthorizedContext,
  limit: number,
): Promise<TimeOffRequestListResult> {
  const rows = await ctx.db.client
    .select()
    .from(timeOffRequests)
    .where(
      and(eq(timeOffRequests.workspaceId, ctx.workspaceId), eq(timeOffRequests.status, 'pending')),
    )
    .orderBy(desc(timeOffRequests.createdAt), asc(timeOffRequests.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toTimeOffRequestDto),
    nextCursor: rows.length > limit && last ? last.id : null,
  };
}

async function getTimeOffBalanceForType(
  ctx: AuthorizedContext,
  type: TimeOffType,
  userId: string,
  year: string,
): Promise<ReturnType<typeof resolveTimeOffBalance>> {
  const allowanceDays = parseAllowance(type.annualAllowanceDays);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const rows = await ctx.db.client
    .select({
      status: timeOffRequests.status,
      days: timeOffRequests.days,
    })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.workspaceId, ctx.workspaceId),
        eq(timeOffRequests.userId, userId),
        eq(timeOffRequests.timeOffTypeId, type.id),
        gte(timeOffRequests.startDate, yearStart),
        lte(timeOffRequests.endDate, yearEnd),
      ),
    );

  let approvedDays = 0;
  let pendingDays = 0;
  for (const row of rows) {
    const status: TimeOffStatus = row.status;
    if (!countsTowardBalance(status)) continue;
    const days = Number(row.days);
    if (status === 'approved') approvedDays += days;
    else pendingDays += days;
  }
  return resolveTimeOffBalance({ allowanceDays, approvedDays, pendingDays });
}

export async function listTimeOffBalances(
  ctx: AuthorizedContext,
  options: { year: number; userId?: string },
  requestId: string,
): Promise<TimeOffBalanceListResult> {
  const userId = options.userId ?? ctx.userId;
  if (userId !== ctx.userId && !hasCanReadTeam(ctx)) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You cannot view other members balances', requestId);
  }
  const year = String(options.year);
  const types = await ctx.db.client
    .select()
    .from(timeOffTypes)
    .where(and(eq(timeOffTypes.workspaceId, ctx.workspaceId), eq(timeOffTypes.active, true)))
    .orderBy(asc(timeOffTypes.name));

  const balances = await Promise.all(
    types.map((type) => getTimeOffBalanceForType(ctx, type, userId, year)),
  );
  return {
    year: options.year,
    items: types.map((type, index) => {
      const balance = balances[index];
      if (!balance) {
        throw toApiError(ERROR_CODES.INTERNAL, 'Failed to load time-off balance', requestId);
      }
      return {
        timeOffTypeId: type.id,
        name: type.name,
        color: type.color,
        paid: type.paid,
        allowanceDays: balance.allowanceDays,
        approvedDays: balance.approvedDays,
        pendingDays: balance.pendingDays,
        usedDays: balance.usedDays,
        remainingDays: balance.remainingDays,
      };
    }),
  };
}

export async function getTimeOffCalendar(
  ctx: AuthorizedContext,
  options: { from: string; to: string },
  requestId: string,
): Promise<TimeOffCalendarResult> {
  if (!isValidTimeOffRange(options.from, options.to)) {
    throw invalidRange(requestId, 'to must be on or after from');
  }

  const [holidayRows, typeRows, requestRows] = await Promise.all([
    ctx.db.client
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.workspaceId, ctx.workspaceId),
          gte(holidays.date, options.from),
          lte(holidays.date, options.to),
        ),
      )
      .orderBy(asc(holidays.date)),
    ctx.db.client.select().from(timeOffTypes).where(eq(timeOffTypes.workspaceId, ctx.workspaceId)),
    ctx.db.client
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.workspaceId, ctx.workspaceId),
          inArray(timeOffRequests.status, ['pending', 'approved']),
          lte(timeOffRequests.startDate, options.to),
          gte(timeOffRequests.endDate, options.from),
        ),
      )
      .orderBy(asc(timeOffRequests.startDate)),
  ]);

  const typeById = new Map(typeRows.map((type) => [type.id, type]));
  const holidayByDate = new Map(holidayRows.map((row) => [row.date, row]));

  const days: TimeOffCalendarResult['days'] = [];
  let cursor = options.from;
  let guard = 0;
  while (cursor <= options.to) {
    const holiday = holidayByDate.get(cursor);
    const covering = requestRows.filter((row) => row.startDate <= cursor && row.endDate >= cursor);
    days.push({
      date: cursor,
      holiday: holiday ? { id: holiday.id, name: holiday.name } : null,
      requests: covering.map((row) => {
        const type = typeById.get(row.timeOffTypeId);
        return {
          id: row.id,
          userId: row.userId,
          timeOffTypeId: row.timeOffTypeId,
          typeName: type?.name ?? 'Time off',
          color: type?.color ?? null,
          startDate: row.startDate,
          endDate: row.endDate,
          status: row.status,
        };
      }),
    });
    const next = new Date(`${cursor}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
    guard += 1;
    if (guard > 366) {
      throw invalidRange(requestId, 'Calendar range is limited to one year');
    }
  }

  return { from: options.from, to: options.to, days };
}

export function parseTimeOffListQuery(
  query: URLSearchParams,
  requestId: string,
): ListRequestOptions {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'userId', 'status', 'typeId', 'from', 'to']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(timeOffListQuerySchema, raw);
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
