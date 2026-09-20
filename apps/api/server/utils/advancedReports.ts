import type { AuthorizedContext } from '@stampp/access';
import type { Rate } from '@stampp/database';
import type { RateCandidate } from '@stampp/domain';
import type {
  ProfitabilityQuery,
  ProfitabilityReport,
  UtilizationQuery,
  UtilizationReport,
} from '@stampp/shared';
import { expenses, projects, rates, timeEntries, users } from '@stampp/database';
import {
  computeMargin,
  computeUtilization,
  filterRateCandidatesAsOf,
  hoursFromMinutes,
  resolveEffectiveRates,
  revenueFromHours,
} from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq, gt, gte, isNull, lte, or } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';

type ReportRow = {
  id: string;
  userId: string;
  userName: string;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  billable: boolean;
  durationMinutes: number | null;
  startAt: Date | null;
  endAt: Date | null;
  workDate: string;
};

function rowMinutes(row: ReportRow): number {
  if (row.durationMinutes !== null) return row.durationMinutes;
  if (!row.startAt) return 0;
  const endAt = row.endAt ?? new Date();
  return Math.max(0, Math.round((endAt.getTime() - row.startAt.getTime()) / 60_000));
}

function toCandidates(rows: Rate[], kind: 'billable' | 'cost', at: Date): RateCandidate[] {
  const candidates: RateCandidate[] = [];
  for (const row of filterRateCandidatesAsOf(rows, at)) {
    if (row.kind !== kind) continue;
    candidates.push({
      scope: row.scope,
      amountMinor: row.amountMinor,
      currency: row.currency,
      userId: row.userId,
      projectId: row.projectId,
      taskId: row.taskId,
    });
  }
  return candidates;
}

function resolveUnitMinor(
  candidates: RateCandidate[],
  target: { userId: string; projectId: string | null; taskId: string | null },
): number {
  return resolveEffectiveRates(candidates, [], target).billable?.amountMinor ?? 0;
}

async function loadTimeRows(
  ctx: AuthorizedContext,
  query: { from: string; to: string; projectId?: string | undefined },
): Promise<ReportRow[]> {
  const conditions = [
    eq(timeEntries.workspaceId, ctx.workspaceId),
    gte(timeEntries.workDate, query.from),
    lte(timeEntries.workDate, query.to),
  ];
  if (query.projectId) conditions.push(eq(timeEntries.projectId, query.projectId));

  return ctx.db.client
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      userName: users.name,
      projectId: timeEntries.projectId,
      projectName: projects.name,
      taskId: timeEntries.taskId,
      billable: timeEntries.billable,
      durationMinutes: timeEntries.durationMinutes,
      startAt: timeEntries.startAt,
      endAt: timeEntries.endAt,
      workDate: timeEntries.workDate,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(
      projects,
      and(eq(projects.id, timeEntries.projectId), eq(projects.workspaceId, ctx.workspaceId)),
    )
    .where(and(...conditions))
    .orderBy(asc(timeEntries.workDate), asc(timeEntries.id));
}

async function loadExpenseRows(
  ctx: AuthorizedContext,
  query: { from: string; to: string; projectId?: string | undefined },
): Promise<{ id: string; projectId: string | null; amountMinor: number }[]> {
  const conditions = [
    eq(expenses.workspaceId, ctx.workspaceId),
    eq(expenses.status, 'approved'),
    gte(expenses.expenseDate, query.from),
    lte(expenses.expenseDate, query.to),
  ];
  if (query.projectId) conditions.push(eq(expenses.projectId, query.projectId));
  return ctx.db.client
    .select({
      id: expenses.id,
      projectId: expenses.projectId,
      amountMinor: expenses.amountMinor,
    })
    .from(expenses)
    .where(and(...conditions));
}

export async function getProfitabilityReport(
  ctx: AuthorizedContext,
  query: ProfitabilityQuery,
  requestId: string,
): Promise<ProfitabilityReport> {
  if (query.from > query.to) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'from must not be after to', requestId);
  }
  const groupBy = query.groupBy ?? 'project';
  const fromInstant = new Date(`${query.from}T00:00:00.000Z`);
  const toInstant = new Date(`${query.to}T23:59:59.999Z`);
  const rateRows = await ctx.db.client
    .select()
    .from(rates)
    .where(
      and(
        eq(rates.workspaceId, ctx.workspaceId),
        lte(rates.effectiveFrom, toInstant),
        or(isNull(rates.effectiveTo), gt(rates.effectiveTo, fromInstant)),
      ),
    );
  const timeRows = await loadTimeRows(ctx, query);
  const expenseRows = await loadExpenseRows(ctx, query);

  type MutableGroup = {
    id: string | null;
    name: string;
    revenueMinor: number;
    laborCostMinor: number;
    expenseMinor: number;
    totalMinutes: number;
    billableMinutes: number;
  };
  const groups = new Map<string, MutableGroup>();

  function ensureGroup(id: string | null, name: string): MutableGroup {
    const key = id ?? 'none';
    let group = groups.get(key);
    if (!group) {
      group = {
        id,
        name,
        revenueMinor: 0,
        laborCostMinor: 0,
        expenseMinor: 0,
        totalMinutes: 0,
        billableMinutes: 0,
      };
      groups.set(key, group);
    }
    return group;
  }

  for (const row of timeRows) {
    const minutes = rowMinutes(row);
    if (minutes <= 0) continue;
    const at = new Date(`${row.workDate}T12:00:00.000Z`);
    const target = { userId: row.userId, projectId: row.projectId, taskId: row.taskId };
    const billableRate = resolveUnitMinor(toCandidates(rateRows, 'billable', at), target);
    const costRate = resolveUnitMinor(toCandidates(rateRows, 'cost', at), target);
    const hours = hoursFromMinutes(minutes);
    const revenue = row.billable ? revenueFromHours(hours, billableRate) : 0;
    const cost = revenueFromHours(hours, costRate);
    const groupId = groupBy === 'user' ? row.userId : row.projectId;
    const groupName =
      groupBy === 'user' ? row.userName : (row.projectName ?? row.projectId ?? 'No project');
    const group = ensureGroup(groupId, groupName);
    group.revenueMinor += revenue;
    group.laborCostMinor += cost;
    group.totalMinutes += minutes;
    if (row.billable) group.billableMinutes += minutes;
  }

  for (const expense of expenseRows) {
    const groupId = groupBy === 'user' ? null : expense.projectId;
    const existing = groups.get(expense.projectId ?? 'none');
    const groupName =
      groupBy === 'user'
        ? 'Unassigned expenses'
        : (existing?.name ?? expense.projectId ?? 'No project');
    ensureGroup(groupId, groupName).expenseMinor += expense.amountMinor;
  }

  let revenueMinor = 0;
  let laborCostMinor = 0;
  let expenseMinor = 0;
  const groupList: ProfitabilityReport['groups'] = [];
  for (const group of groups.values()) {
    revenueMinor += group.revenueMinor;
    laborCostMinor += group.laborCostMinor;
    expenseMinor += group.expenseMinor;
    const margin = computeMargin(group);
    groupList.push({
      id: group.id,
      name: group.name,
      revenueMinor: margin.revenueMinor,
      laborCostMinor: margin.laborCostMinor,
      expenseMinor: margin.expenseMinor,
      profitMinor: margin.profitMinor,
      marginRatio: margin.marginRatio,
      totalMinutes: group.totalMinutes,
      billableMinutes: group.billableMinutes,
    });
  }
  const sorted = groupList.toSorted(
    (left, right) =>
      left.name.localeCompare(right.name) || (left.id ?? '').localeCompare(right.id ?? ''),
  );
  const totals = computeMargin({ revenueMinor, laborCostMinor, expenseMinor });

  return {
    from: query.from,
    to: query.to,
    timezone: query.timezone,
    groupBy,
    currency: 'USD',
    totals: {
      revenueMinor: totals.revenueMinor,
      laborCostMinor: totals.laborCostMinor,
      expenseMinor: totals.expenseMinor,
      profitMinor: totals.profitMinor,
      marginRatio: totals.marginRatio,
    },
    groups: sorted,
  };
}

export async function getUtilizationReport(
  ctx: AuthorizedContext,
  query: UtilizationQuery,
  requestId: string,
): Promise<UtilizationReport> {
  if (query.from > query.to) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'from must not be after to', requestId);
  }
  const groupBy = query.groupBy ?? 'user';
  const timeRows = await loadTimeRows(ctx, query);

  const groups = new Map<
    string,
    { id: string | null; name: string; totalMinutes: number; billableMinutes: number }
  >();
  for (const row of timeRows) {
    const minutes = rowMinutes(row);
    if (minutes <= 0) continue;
    const id = groupBy === 'user' ? row.userId : row.projectId;
    const name =
      groupBy === 'user' ? row.userName : (row.projectName ?? row.projectId ?? 'No project');
    const key = id ?? 'none';
    let group = groups.get(key);
    if (!group) {
      group = { id, name, totalMinutes: 0, billableMinutes: 0 };
      groups.set(key, group);
    }
    group.totalMinutes += minutes;
    if (row.billable) group.billableMinutes += minutes;
  }

  let totalMinutes = 0;
  let billableMinutes = 0;
  const groupList: UtilizationReport['groups'] = [];
  for (const group of groups.values()) {
    totalMinutes += group.totalMinutes;
    billableMinutes += group.billableMinutes;
    const utilization = computeUtilization(group.totalMinutes, group.billableMinutes);
    groupList.push({
      id: group.id,
      name: group.name,
      totalMinutes: utilization.totalMinutes,
      billableMinutes: utilization.billableMinutes,
      nonBillableMinutes: utilization.nonBillableMinutes,
      utilizationRatio: utilization.utilizationRatio,
    });
  }
  const sorted = groupList.toSorted(
    (left, right) =>
      left.name.localeCompare(right.name) || (left.id ?? '').localeCompare(right.id ?? ''),
  );
  const totals = computeUtilization(totalMinutes, billableMinutes);

  return {
    from: query.from,
    to: query.to,
    timezone: query.timezone,
    groupBy,
    totals: {
      totalMinutes: totals.totalMinutes,
      billableMinutes: totals.billableMinutes,
      nonBillableMinutes: totals.nonBillableMinutes,
      utilizationRatio: totals.utilizationRatio,
    },
    groups: sorted,
  };
}

function csv(rows: string[][]): string {
  return `${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
}

export function profitabilityReportCsv(report: ProfitabilityReport): string {
  const rows = [
    [
      'group_type',
      'group_id',
      'group_name',
      'revenue_minor',
      'labor_cost_minor',
      'expense_minor',
      'profit_minor',
      'margin_ratio',
      'total_minutes',
      'billable_minutes',
    ],
  ];
  for (const group of report.groups) {
    rows.push([
      report.groupBy,
      group.id ?? '',
      group.name,
      String(group.revenueMinor),
      String(group.laborCostMinor),
      String(group.expenseMinor),
      String(group.profitMinor),
      group.marginRatio === null ? '' : String(group.marginRatio),
      String(group.totalMinutes),
      String(group.billableMinutes),
    ]);
  }
  return csv(rows);
}

export function utilizationReportCsv(report: UtilizationReport): string {
  const rows = [
    [
      'group_type',
      'group_id',
      'group_name',
      'total_minutes',
      'billable_minutes',
      'non_billable_minutes',
      'utilization_ratio',
    ],
  ];
  for (const group of report.groups) {
    rows.push([
      report.groupBy,
      group.id ?? '',
      group.name,
      String(group.totalMinutes),
      String(group.billableMinutes),
      String(group.nonBillableMinutes),
      group.utilizationRatio === null ? '' : String(group.utilizationRatio),
    ]);
  }
  return csv(rows);
}
