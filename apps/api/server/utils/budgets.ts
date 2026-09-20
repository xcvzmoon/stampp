import type { AuthorizedContext } from '@stampp/access';
import type { RateCandidate } from '@stampp/domain';
import type { ProjectBudgetUsage } from '@stampp/shared';
import { projects, rates, timeEntries } from '@stampp/database';
import { resolveBudgetUsage, resolveEffectiveRates } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';

function entryMinutes(
  row: {
    durationMinutes: number | null;
    startAt: Date | null;
    endAt: Date | null;
  },
  now: Date,
): number {
  if (row.durationMinutes !== null) return row.durationMinutes;
  if (!row.startAt) return 0;
  const endAt = row.endAt ?? now;
  return Math.max(0, Math.round((endAt.getTime() - row.startAt.getTime()) / 60_000));
}

async function loadProjectBillableRateMinor(
  ctx: AuthorizedContext,
  projectId: string,
  at: Date,
): Promise<number | null> {
  const rows = await ctx.db.client
    .select()
    .from(rates)
    .where(
      and(
        eq(rates.workspaceId, ctx.workspaceId),
        eq(rates.kind, 'billable'),
        inArray(rates.scope, ['project', 'org']),
        lte(rates.effectiveFrom, at),
        or(isNull(rates.effectiveTo), gt(rates.effectiveTo, at)),
      ),
    );

  const candidates: RateCandidate[] = [];
  for (const row of rows) {
    candidates.push({
      scope: row.scope === 'project' ? 'project' : 'org',
      amountMinor: row.amountMinor,
      currency: row.currency,
      projectId: row.projectId,
    });
  }
  const effective = resolveEffectiveRates(candidates, [], { projectId });
  return effective.billable?.amountMinor ?? null;
}

export async function getProjectBudgetUsage(
  ctx: AuthorizedContext,
  projectId: string,
  requestId: string,
): Promise<ProjectBudgetUsage> {
  const projectRows = await ctx.db.client
    .select()
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

  const now = new Date();
  const entryRows = await ctx.db.client
    .select({
      durationMinutes: timeEntries.durationMinutes,
      startAt: timeEntries.startAt,
      endAt: timeEntries.endAt,
      billable: timeEntries.billable,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.workspaceId, ctx.workspaceId), eq(timeEntries.projectId, projectId)));

  let usedMinutes = 0;
  let usedBillableMinutes = 0;
  for (const row of entryRows) {
    const minutes = entryMinutes(row, now);
    usedMinutes += minutes;
    if (row.billable) usedBillableMinutes += minutes;
  }

  let usedAmountMinor = 0;
  if (project.budgetAmountMinor !== null) {
    const rateMinor = await loadProjectBillableRateMinor(ctx, projectId, now);
    if (rateMinor !== null) {
      usedAmountMinor = Math.round((usedBillableMinutes / 60) * rateMinor);
    }
  }

  const usage = resolveBudgetUsage({
    usedMinutes,
    budgetMinutes: project.budgetMinutes,
    usedAmountMinor,
    budgetAmountMinor: project.budgetAmountMinor,
    currency: project.budgetCurrency,
    alertAtPercent: project.budgetAlertAtPercent,
  });

  return {
    projectId: project.id,
    projectName: project.name,
    ...usage,
  };
}

export async function listProjectBudgetUsages(
  ctx: AuthorizedContext,
): Promise<ProjectBudgetUsage[]> {
  const projectRows = await ctx.db.client
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, ctx.workspaceId), isNull(projects.deletedAt)));

  const usages = await Promise.all(
    projectRows.map((row) => getProjectBudgetUsage(ctx, row.id, 'budget-list')),
  );
  const items: ProjectBudgetUsage[] = [];
  for (const usage of usages) {
    if (usage.budgetMinutes !== null || usage.budgetAmountMinor !== null) {
      items.push(usage);
    }
  }
  return items;
}
