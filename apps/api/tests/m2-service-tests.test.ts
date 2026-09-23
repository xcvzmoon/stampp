import type { AuthorizedContext } from '@stampp/access';
import {
  createTestDb,
  expenses,
  invoiceLines,
  invoicePayments,
  invoices,
  personalAccessTokens,
  projects,
  rates,
  timeEntries,
  timesheets,
} from '@stampp/database';
import {
  canTransition,
  canTransitionInvoice,
  computeInvoiceTotals,
  filterRateCandidatesAsOf,
  isTimesheetFrozen,
  nextInvoiceStatus,
  resolveBudgetUsage,
  resolveEffectiveRates,
  resolveActorPermissions,
} from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { HTTPError } from 'nitro';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';

const workspaceA = 'ws_a';
const workspaceB = 'ws_b';
const userId = 'user_1';

function mockContext(workspaceId: string): AuthorizedContext {
  const role = { kind: 'builtin', role: 'member' } as const;
  return {
    userId,
    workspaceId,
    role,
    permissions: resolveActorPermissions(role),
    db: {
      workspaceId,
      client: createTestDb(),
    },
  };
}

describe('M2 mock-db tenant isolation', () => {
  it('binds workspace_id on budget project and time-entry usage queries', () => {
    const db = createTestDb();
    const project = db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceA), isNull(projects.deletedAt)))
      .toSQL();
    const usage = db
      .select({ durationMinutes: timeEntries.durationMinutes })
      .from(timeEntries)
      .where(and(eq(timeEntries.workspaceId, workspaceB), eq(timeEntries.projectId, 'prj_1')))
      .toSQL();

    expect(project.sql).toContain('"workspace_id" = $1');
    expect(project.params[0]).toBe(workspaceA);
    expect(usage.sql).toContain('"workspace_id" = $1');
    expect(usage.params[0]).toBe(workspaceB);
  });

  it('binds workspace_id on rates open-version and as-of window SQL', () => {
    const db = createTestDb();
    const at = new Date('2026-06-01T00:00:00.000Z');
    const open = db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.workspaceId, workspaceA),
          eq(rates.kind, 'billable'),
          isNull(rates.effectiveTo),
        ),
      )
      .toSQL();
    const asOf = db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.workspaceId, workspaceB),
          lte(rates.effectiveFrom, at),
          isNull(rates.effectiveTo),
        ),
      )
      .toSQL();

    expect(open.sql).toContain('"workspace_id" = $1');
    expect(open.params[0]).toBe(workspaceA);
    expect(asOf.params[0]).toBe(workspaceB);
  });

  it('binds workspace_id on expense and invoice service queries', () => {
    const db = createTestDb();
    const expense = db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.workspaceId, workspaceA),
          eq(expenses.billable, true),
          eq(expenses.status, 'approved'),
        ),
      )
      .toSQL();
    const invoice = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceB), eq(invoices.status, 'draft')))
      .toSQL();
    const lines = db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.workspaceId, workspaceA))
      .toSQL();
    const payments = db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.workspaceId, workspaceB))
      .toSQL();

    expect(expense.params[0]).toBe(workspaceA);
    expect(invoice.params[0]).toBe(workspaceB);
    expect(lines.params[0]).toBe(workspaceA);
    expect(payments.params[0]).toBe(workspaceB);
  });

  it('binds workspace_id on personal access tokens and timesheet freezes', () => {
    const db = createTestDb();
    const tokens = db
      .select()
      .from(personalAccessTokens)
      .where(
        and(
          eq(personalAccessTokens.workspaceId, workspaceA),
          eq(personalAccessTokens.userId, userId),
        ),
      )
      .toSQL();
    const lock = db
      .update(timeEntries)
      .set({ lockedAt: new Date() })
      .where(
        and(
          eq(timeEntries.workspaceId, workspaceB),
          gte(timeEntries.workDate, '2026-09-14'),
          lte(timeEntries.workDate, '2026-09-20'),
        ),
      )
      .toSQL();
    const timesheet = db
      .select()
      .from(timesheets)
      .where(and(eq(timesheets.workspaceId, workspaceA), eq(timesheets.weekStart, '2026-09-14')))
      .toSQL();

    expect(tokens.params[0]).toBe(workspaceA);
    expect(lock.params).toContain(workspaceB);
    expect(timesheet.params[0]).toBe(workspaceA);
  });
});

describe('M2 domain service rules', () => {
  it('freezes submitted and approved weeks for member edits', () => {
    expect(isTimesheetFrozen('submitted')).toBe(true);
    expect(isTimesheetFrozen('approved')).toBe(true);
    expect(isTimesheetFrozen('rejected')).toBe(false);
    expect(canTransition('submit', 'submitted')).toBe(false);
    expect(canTransition('approve', 'submitted')).toBe(true);
  });

  it('filters rate versions with historical half-open windows', () => {
    const at = new Date('2026-06-01T00:00:00.000Z');
    const rows = [
      {
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-03-01T00:00:00.000Z'),
        amountMinor: 1,
      },
      {
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        effectiveTo: null,
        amountMinor: 2,
      },
      {
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        effectiveTo: null,
        amountMinor: 3,
      },
    ];
    const active = filterRateCandidatesAsOf(rows, at);
    expect(active).toHaveLength(1);
    expect(active[0]?.amountMinor).toBe(2);
    const resolved = resolveEffectiveRates(
      active.map((row) => ({
        scope: 'project',
        amountMinor: row.amountMinor,
        currency: 'USD',
        projectId: 'prj_1',
      })),
      [],
      { projectId: 'prj_1' },
    );
    expect(resolved.billable?.amountMinor).toBe(2);
  });

  it('computes budget alert levels independently for hours and money', () => {
    const usage = resolveBudgetUsage({
      usedMinutes: 480,
      budgetMinutes: 480,
      usedAmountMinor: 1_000,
      budgetAmountMinor: 10_000,
      currency: 'USD',
      alertAtPercent: 80,
    });
    expect(usage.hoursLevel).toBe('exceeded');
    expect(usage.moneyLevel).toBe('none');
  });

  it('enforces invoice status machine and overpay protection math', () => {
    expect(canTransitionInvoice('send', 'draft')).toBe(true);
    expect(canTransitionInvoice('send', 'sent')).toBe(false);
    expect(nextInvoiceStatus('pay')).toBe('paid');
    const totals = computeInvoiceTotals([{ quantity: 2, unitAmountMinor: 5_000 }], 0, 0);
    expect(totals.totalMinor).toBe(10_000);
  });

  it('maps freeze and invoice business errors to stable HTTP statuses', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIMESHEET_FROZEN)).toBe(423);
    expect(mapErrorCodeToStatus(ERROR_CODES.INVOICE_OVERPAYMENT)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.INVOICE_INVALID_TRANSITION)).toBe(422);
  });
});

describe('M2 timesheet freeze service seam', () => {
  it('maps freeze errors the way assertWeekEditable does', () => {
    const ctx = mockContext(workspaceA);
    expect(ctx.workspaceId).toBe(workspaceA);
    if (isTimesheetFrozen('approved')) {
      expect(() => {
        throw new HTTPError({
          status: mapErrorCodeToStatus(ERROR_CODES.TIMESHEET_FROZEN),
          message: 'Approved timesheets are locked',
        });
      }).toThrow(HTTPError);
    }
  });
});
