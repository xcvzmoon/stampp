import type { HTTPError } from 'nitro';
import { describe, expect, it } from 'vite-plus/test';
import { getProjectBudgetUsage } from '~/server/utils/budgets.ts';
import { resolveRates } from '~/server/utils/rates.ts';
import { assertWeekEditable, getOwnTimesheetState } from '~/server/utils/timesheets.ts';
import { createScriptedDb, scriptedContext } from './helpers/scriptedDb.ts';

const workspaceId = 'ws_flow';
const userId = 'user_flow';
const projectId = 'prj_flow';

const fixedNow = new Date('2026-09-20T12:00:00.000Z');

/** rates SELECT order: id, workspace_id, kind, scope, user_id, project_id, task_id, amount_minor, currency, effective_from, effective_to, created_at, updated_at, deleted_at */
function rateRow(input: {
  id: string;
  kind: 'billable' | 'cost';
  scope: 'org' | 'user' | 'project' | 'user_project' | 'task';
  amountMinor: number;
  userId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}): unknown[] {
  return [
    input.id,
    workspaceId,
    input.kind,
    input.scope,
    input.userId ?? null,
    input.projectId ?? null,
    input.taskId ?? null,
    input.amountMinor,
    'USD',
    input.effectiveFrom ?? new Date('2026-01-01T00:00:00.000Z'),
    input.effectiveTo ?? null,
    fixedNow,
    fixedNow,
    null,
  ];
}

/** projects SELECT order matches schema field order. */
function projectRow(input: {
  budgetMinutes: number | null;
  budgetAmountMinor: number | null;
  budgetCurrency: string | null;
  budgetAlertAtPercent: number;
}): unknown[] {
  return [
    projectId,
    workspaceId,
    null,
    'Alpha',
    'ALP',
    '#000000',
    'active',
    true,
    null,
    input.budgetMinutes,
    input.budgetAmountMinor,
    input.budgetCurrency,
    input.budgetAlertAtPercent,
    fixedNow,
    fixedNow,
    null,
  ];
}

/** time_entries full-column order for budget usage duration select (partial columns in query). */
function budgetEntryRow(minutes: number, billable: boolean): unknown[] {
  return [minutes, null, null, billable];
}

/** timesheets SELECT order. */
function timesheetRow(status: 'submitted' | 'approved' | 'rejected'): unknown[] {
  return [
    'ts_flow',
    workspaceId,
    userId,
    '2026-09-14',
    status,
    fixedNow,
    null,
    null,
    null,
    null,
    status === 'approved' ? fixedNow : null,
    fixedNow,
    fixedNow,
    null,
  ];
}

describe('budget service flow', () => {
  it('computes money usage from billable minutes and project rate', async () => {
    const { db } = createScriptedDb((sql) => {
      if (sql.includes('from "projects"')) {
        return [
          projectRow({
            budgetMinutes: 480,
            budgetAmountMinor: 100_000,
            budgetCurrency: 'USD',
            budgetAlertAtPercent: 80,
          }),
        ];
      }
      if (sql.includes('from "time_entries"')) {
        return [budgetEntryRow(120, true), budgetEntryRow(60, false)];
      }
      if (sql.includes('from "rates"')) {
        return [
          rateRow({
            id: 'rate_b',
            kind: 'billable',
            scope: 'project',
            amountMinor: 10_000,
            projectId,
          }),
        ];
      }
      throw new Error(`Unexpected SQL in budget flow: ${sql}`);
    });

    const usage = await getProjectBudgetUsage(
      scriptedContext(db, workspaceId, userId, 'manager'),
      projectId,
      'req_budget',
    );
    expect(usage.usedMinutes).toBe(180);
    expect(usage.usedAmountMinor).toBe(20_000);
    expect(usage.hoursLevel).toBe('none');
    expect(usage.moneyLevel).toBe('none');
    expect(usage.projectName).toBe('Alpha');
  });

  it('raises hours exceeded and money warning independently', async () => {
    const { db } = createScriptedDb((sql) => {
      if (sql.includes('from "projects"')) {
        return [
          projectRow({
            budgetMinutes: 120,
            budgetAmountMinor: 100_000,
            budgetCurrency: 'USD',
            budgetAlertAtPercent: 80,
          }),
        ];
      }
      if (sql.includes('from "time_entries"')) {
        return [budgetEntryRow(120, true)];
      }
      if (sql.includes('from "rates"')) {
        // 120 billable minutes × 50000/60 = 100000 money used vs 100000 budget → exceeded;
        // pair with a large money budget so only hours exceed.
        return [rateRow({ id: 'rate_b', kind: 'billable', scope: 'org', amountMinor: 10_000 })];
      }
      throw new Error(`Unexpected SQL in budget flow: ${sql}`);
    });

    const usage = await getProjectBudgetUsage(
      scriptedContext(db, workspaceId, userId, 'manager'),
      projectId,
      'req_budget',
    );
    expect(usage.hoursLevel).toBe('exceeded');
    expect(usage.moneyLevel).toBe('none');
    expect(usage.usedAmountMinor).toBe(20_000);
  });
});

describe('rates resolve service flow', () => {
  it('applies task over project over org precedence as-of the query instant', async () => {
    const { db } = createScriptedDb((sql) => {
      if (!sql.includes('from "rates"')) {
        throw new Error(`Unexpected SQL in rates flow: ${sql}`);
      }
      return [
        rateRow({ id: 'rate_org', kind: 'billable', scope: 'org', amountMinor: 1_000 }),
        rateRow({
          id: 'rate_prj',
          kind: 'billable',
          scope: 'project',
          amountMinor: 2_000,
          projectId,
        }),
        rateRow({
          id: 'rate_task',
          kind: 'billable',
          scope: 'task',
          amountMinor: 3_000,
          projectId,
          taskId: 'tsk_1',
        }),
        rateRow({ id: 'rate_cost', kind: 'cost', scope: 'user', amountMinor: 4_000, userId }),
        rateRow({
          id: 'rate_old',
          kind: 'billable',
          scope: 'org',
          amountMinor: 999,
          effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2021-01-01T00:00:00.000Z'),
        }),
      ];
    });

    const resolved = await resolveRates(
      scriptedContext(db, workspaceId, userId, 'manager'),
      {
        at: '2026-06-01T12:00:00.000Z',
        userId,
        projectId,
        taskId: 'tsk_1',
      },
      'req_rates',
    );
    expect(resolved.billable?.amountMinor).toBe(3_000);
    expect(resolved.cost?.amountMinor).toBe(4_000);
    expect(resolved.source).toBe('task');
    expect(resolved.currency).toBe('USD');
  });

  it('rejects taskId without projectId before querying', async () => {
    const { db, queries } = createScriptedDb(() => []);
    await expect(
      resolveRates(scriptedContext(db, workspaceId, userId), { taskId: 'tsk_1' }, 'req_rates'),
    ).rejects.toThrow();
    expect(queries).toHaveLength(0);
  });
});

describe('timesheet freeze service flow', () => {
  it('reports submitted weeks as not editable', async () => {
    const { db } = createScriptedDb((sql) => {
      if (sql.includes('from "timesheets"')) {
        return [timesheetRow('submitted')];
      }
      throw new Error(`Unexpected SQL in timesheet flow: ${sql}`);
    });

    const state = await getOwnTimesheetState(
      scriptedContext(db, workspaceId, userId),
      '2026-09-14',
      'req_ts',
    );
    expect(state.status).toBe('submitted');
    expect(state.editable).toBe(false);
    expect(state.timesheet?.id).toBe('ts_flow');
  });

  it('blocks member edits on approved weeks with 423 mapped error', async () => {
    const { db } = createScriptedDb((sql) => {
      if (sql.includes('from "timesheets"')) {
        return [timesheetRow('approved')];
      }
      throw new Error(`Unexpected SQL in timesheet flow: ${sql}`);
    });

    const failure = await assertWeekEditable(
      scriptedContext(db, workspaceId, userId),
      '2026-09-14',
      'req_ts',
    ).then(
      () => null,
      (error: HTTPError) => error,
    );
    expect(failure).not.toBeNull();
    expect(failure).toMatchObject({ status: 423 });
  });

  it('allows edits when the week has no timesheet row', async () => {
    const { db } = createScriptedDb((sql) => {
      if (sql.includes('from "timesheets"')) {
        return [];
      }
      throw new Error(`Unexpected SQL in timesheet flow: ${sql}`);
    });

    await expect(
      assertWeekEditable(scriptedContext(db, workspaceId, userId), '2026-09-14', 'req_ts'),
    ).resolves.toBeUndefined();
  });
});
