import type { AuthorizedContext } from '@stampp/access';
import type { Timesheet } from '@stampp/database';
import type {
  DecideTimesheetInput,
  OwnTimesheetState,
  SubmitTimesheetInput,
  TimesheetDto,
  TimesheetListQuery,
  TimesheetStatus,
  WithdrawTimesheetInput,
} from '@stampp/shared';
import { timeEntries, timesheets } from '@stampp/database';
import { canTransition, isTimesheetFrozen, nextStatus } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, desc, eq, gt, gte, isNull, lte, type SQL } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import {
  cancelApprovalRun,
  decideApprovalRun,
  getPendingRunForEntity,
  startApprovalRun,
} from '~/server/utils/approvalChains.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import {
  notifyTimesheetDecision,
  notifyTimesheetSubmitted,
} from '~/server/utils/productNotifications.ts';
import { emitWebhookEvent } from '~/server/utils/webhookEvents.ts';
import { addCalendarDays, requireMonday } from '~/server/utils/week.ts';

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Timesheet not found', requestId);
}

function invalidTransition(requestId: string, message: string) {
  return toApiError(ERROR_CODES.TIMESHEET_INVALID_TRANSITION, message, requestId);
}

function emptyWeek(requestId: string) {
  return toApiError(ERROR_CODES.TIMESHEET_EMPTY, 'Week has no time entries to submit', requestId);
}

export function toTimesheetDto(row: Timesheet): TimesheetDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    weekStart: row.weekStart,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    submitNote: row.submitNote,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function weekScope(workspaceId: string, userId: string, weekStart: string): SQL {
  const weekEnd = addCalendarDays(weekStart, 6);
  const scope = and(
    eq(timeEntries.workspaceId, workspaceId),
    eq(timeEntries.userId, userId),
    gte(timeEntries.workDate, weekStart),
    lte(timeEntries.workDate, weekEnd),
  );
  if (!scope) {
    throw new Error('week scope predicate is empty');
  }
  return scope;
}

async function getOwnTimesheet(
  ctx: AuthorizedContext,
  weekStart: string,
): Promise<Timesheet | null> {
  const rows = await ctx.db.client
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.workspaceId, ctx.workspaceId),
        eq(timesheets.userId, ctx.userId),
        eq(timesheets.weekStart, weekStart),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function getTimesheetRow(
  ctx: AuthorizedContext,
  timesheetId: string,
  requestId: string,
): Promise<Timesheet> {
  const rows = await ctx.db.client
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.workspaceId, ctx.workspaceId), eq(timesheets.id, timesheetId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

export async function getOwnTimesheetState(
  ctx: AuthorizedContext,
  weekStart: string,
  requestId: string,
): Promise<OwnTimesheetState> {
  requireMonday(weekStart, requestId);
  const row = await getOwnTimesheet(ctx, weekStart);
  const status: TimesheetStatus | null = row?.status ?? null;
  return {
    weekStart,
    status,
    timesheet: row ? toTimesheetDto(row) : null,
    editable: !isTimesheetFrozen(status),
  };
}

export async function submitTimesheet(
  ctx: AuthorizedContext,
  input: SubmitTimesheetInput,
  requestId: string,
): Promise<TimesheetDto> {
  requireMonday(input.weekStart, requestId);
  const existing = await getOwnTimesheet(ctx, input.weekStart);
  const current = existing?.status ?? null;
  if (!canTransition('submit', current)) {
    throw invalidTransition(requestId, `Cannot submit a timesheet that is ${current ?? 'draft'}`);
  }

  const entryRows = await ctx.db.client
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(weekScope(ctx.workspaceId, ctx.userId, input.weekStart))
    .limit(1);
  if (!entryRows[0]) throw emptyWeek(requestId);

  const now = new Date();
  const row = await ctx.db.client.transaction(async (tx) => {
    if (existing) {
      const updated = await tx
        .update(timesheets)
        .set({
          status: nextStatus('submit'),
          submittedAt: now,
          submitNote: input.note ?? null,
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          lockedAt: null,
          updatedAt: now,
        })
        .where(and(eq(timesheets.id, existing.id), eq(timesheets.status, existing.status)))
        .returning();
      const next = updated[0];
      if (!next) {
        throw toApiError(ERROR_CODES.CONFLICT, 'Timesheet changed concurrently', requestId);
      }
      return next;
    }

    const inserted = await tx
      .insert(timesheets)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        weekStart: input.weekStart,
        status: 'submitted',
        submittedAt: now,
        submitNote: input.note ?? null,
      })
      .returning();
    const created = inserted[0];
    if (!created) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to submit timesheet', requestId);
    }
    return created;
  });

  await recordAudit(ctx, requestId, {
    action: 'timesheet.submitted',
    entityType: 'timesheet',
    entityId: row.id,
    after: row,
  });
  await startApprovalRun(ctx, 'timesheet', row.id, ctx.userId, requestId);
  await notifyTimesheetSubmitted(ctx, {
    memberUserId: ctx.userId,
    weekStart: row.weekStart,
    workspaceId: ctx.workspaceId,
  }).catch(() => undefined);
  await emitWebhookEvent(ctx, 'timesheet.submitted', { timesheet: toTimesheetDto(row) });
  return toTimesheetDto(row);
}

export async function withdrawTimesheet(
  ctx: AuthorizedContext,
  input: WithdrawTimesheetInput,
  requestId: string,
): Promise<void> {
  requireMonday(input.weekStart, requestId);
  const existing = await getOwnTimesheet(ctx, input.weekStart);
  if (!existing) throw notFound(requestId);
  if (!canTransition('withdraw', existing.status)) {
    throw invalidTransition(requestId, `Cannot withdraw a timesheet that is ${existing.status}`);
  }

  await ctx.db.client.delete(timesheets).where(eq(timesheets.id, existing.id));
  await cancelApprovalRun(ctx, 'timesheet', existing.id, requestId, 'withdrawn');
  await recordAudit(ctx, requestId, {
    action: 'timesheet.withdrawn',
    entityType: 'timesheet',
    entityId: existing.id,
    before: existing,
  });
}

async function decide(
  ctx: AuthorizedContext,
  timesheetId: string,
  action: 'approve' | 'reject',
  input: DecideTimesheetInput,
  requestId: string,
): Promise<TimesheetDto> {
  const before = await getTimesheetRow(ctx, timesheetId, requestId);
  if (!canTransition(action, before.status)) {
    throw invalidTransition(requestId, `Cannot ${action} a timesheet that is ${before.status}`);
  }
  if (action === 'reject' && !input.note) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Rejection requires a note', requestId);
  }
  if (before.userId === ctx.userId && action === 'approve') {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You cannot approve your own timesheet', requestId);
  }

  const pendingRun = await getPendingRunForEntity(ctx, 'timesheet', before.id);
  if (pendingRun) {
    const { isFinalStep } = await decideApprovalRun(
      ctx,
      pendingRun.id,
      { action, note: input.note },
      requestId,
    );
    if (action === 'approve' && !isFinalStep) {
      await recordAudit(ctx, requestId, {
        action: 'timesheet.chain_step',
        entityType: 'timesheet',
        entityId: before.id,
        before,
        after: { approvalRunId: pendingRun.id, currentStepPending: true },
      });
      return toTimesheetDto(before);
    }
    // fall through to finalize reject, or final-step approve
  }

  const now = new Date();
  const weekEnd = addCalendarDays(before.weekStart, 6);

  const row = await ctx.db.client.transaction(async (tx) => {
    if (action === 'approve') {
      await tx
        .update(timeEntries)
        .set({ lockedAt: now, updatedAt: now })
        .where(
          and(
            eq(timeEntries.workspaceId, ctx.workspaceId),
            eq(timeEntries.userId, before.userId),
            gte(timeEntries.workDate, before.weekStart),
            lte(timeEntries.workDate, weekEnd),
            isNull(timeEntries.lockedAt),
          ),
        );
    } else {
      await tx
        .update(timeEntries)
        .set({ lockedAt: null, updatedAt: now })
        .where(
          and(
            eq(timeEntries.workspaceId, ctx.workspaceId),
            eq(timeEntries.userId, before.userId),
            gte(timeEntries.workDate, before.weekStart),
            lte(timeEntries.workDate, weekEnd),
          ),
        );
    }

    const updated = await tx
      .update(timesheets)
      .set({
        status: nextStatus(action),
        decidedAt: now,
        decidedBy: ctx.userId,
        decisionNote: input.note ?? null,
        lockedAt: action === 'approve' ? now : null,
        updatedAt: now,
      })
      .where(and(eq(timesheets.id, before.id), eq(timesheets.status, before.status)))
      .returning();
    const next = updated[0];
    if (!next) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Timesheet changed concurrently', requestId);
    }
    return next;
  });

  await recordAudit(ctx, requestId, {
    action: action === 'approve' ? 'timesheet.approved' : 'timesheet.rejected',
    entityType: 'timesheet',
    entityId: row.id,
    before,
    after: row,
  });
  await notifyTimesheetDecision(ctx, {
    memberUserId: before.userId,
    weekStart: before.weekStart,
    workspaceId: ctx.workspaceId,
    decision: action === 'approve' ? 'approved' : 'rejected',
    note: input.note,
  }).catch(() => undefined);
  await emitWebhookEvent(ctx, action === 'approve' ? 'timesheet.approved' : 'timesheet.rejected', {
    timesheet: toTimesheetDto(row),
  });
  return toTimesheetDto(row);
}

export async function approveTimesheet(
  ctx: AuthorizedContext,
  timesheetId: string,
  input: DecideTimesheetInput,
  requestId: string,
): Promise<TimesheetDto> {
  return decide(ctx, timesheetId, 'approve', input, requestId);
}

export async function rejectTimesheet(
  ctx: AuthorizedContext,
  timesheetId: string,
  input: DecideTimesheetInput,
  requestId: string,
): Promise<TimesheetDto> {
  return decide(ctx, timesheetId, 'reject', input, requestId);
}

export async function listTimesheets(
  ctx: AuthorizedContext,
  options: TimesheetListQuery & { limit: number },
): Promise<{ items: TimesheetDto[]; nextCursor: string | null }> {
  const conditions: SQL[] = [eq(timesheets.workspaceId, ctx.workspaceId)];
  if (options.cursor) conditions.push(gt(timesheets.id, options.cursor));
  if (options.weekStart) conditions.push(eq(timesheets.weekStart, options.weekStart));
  if (options.userId) conditions.push(eq(timesheets.userId, options.userId));
  if (options.status) conditions.push(eq(timesheets.status, options.status));

  const rows = await ctx.db.client
    .select()
    .from(timesheets)
    .where(and(...conditions))
    .orderBy(asc(timesheets.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toTimesheetDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function listPendingTimesheets(
  ctx: AuthorizedContext,
  limit: number,
): Promise<{ items: TimesheetDto[]; nextCursor: string | null }> {
  const rows = await ctx.db.client
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.workspaceId, ctx.workspaceId), eq(timesheets.status, 'submitted')))
    .orderBy(desc(timesheets.submittedAt), asc(timesheets.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toTimesheetDto),
    nextCursor: rows.length > limit && last ? last.id : null,
  };
}

/** Blocks member edits while the week is submitted or approved. */
export async function assertWeekEditable(
  ctx: AuthorizedContext,
  weekStart: string,
  requestId: string,
): Promise<void> {
  const row = await getOwnTimesheet(ctx, weekStart);
  if (row && isTimesheetFrozen(row.status)) {
    throw toApiError(
      ERROR_CODES.TIMESHEET_FROZEN,
      row.status === 'approved'
        ? 'Approved timesheets are locked'
        : 'Submitted timesheets cannot be edited until withdrawn or decided',
      requestId,
    );
  }
}

export async function assertEntryWeekEditable(
  ctx: AuthorizedContext,
  workDate: string,
  requestId: string,
): Promise<void> {
  await assertWeekEditable(ctx, mondayForWorkDate(workDate), requestId);
}

function mondayForWorkDate(workDate: string): string {
  const day = new Date(`${workDate}T00:00:00.000Z`).getUTCDay();
  return addCalendarDays(workDate, -(day === 0 ? 6 : day - 1));
}

export async function listTimesheetsForExport(ctx: AuthorizedContext): Promise<Timesheet[]> {
  return ctx.db.client
    .select()
    .from(timesheets)
    .where(eq(timesheets.workspaceId, ctx.workspaceId))
    .orderBy(asc(timesheets.id));
}
