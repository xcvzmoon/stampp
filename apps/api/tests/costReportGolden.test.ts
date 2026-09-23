import type { ProfitabilityQuery } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import {
  getProfitabilityReport,
  getUtilizationReport,
  profitabilityReportCsv,
} from '~/server/utils/advancedReports.ts';
import { createScriptedDb, scriptedContext } from './helpers/scriptedDb.ts';

const workspaceId = 'ws_golden';
const userId = 'user_golden';
const projectId = 'prj_golden';

const query: ProfitabilityQuery = {
  from: '2026-09-01',
  to: '2026-09-30',
  timezone: 'UTC',
  groupBy: 'project',
};

/**
 * loadTimeRows SELECT order:
 * time_entries.id, user_id, users.name, project_id, projects.name, task_id,
 * billable, duration_minutes, start_at, end_at, work_date
 */
function timeRow(input: {
  id: string;
  durationMinutes: number | null;
  billable: boolean;
  projectId?: string | null;
  projectName?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
}): unknown[] {
  return [
    input.id,
    userId,
    'Ada',
    input.projectId === undefined ? projectId : input.projectId,
    input.projectName === undefined ? 'Alpha' : input.projectName,
    null,
    input.billable,
    input.durationMinutes,
    input.startAt ?? null,
    input.endAt ?? null,
    '2026-09-15',
  ];
}

/** loadExpenseRows SELECT order: expenses.id, project_id, amount_minor */
function expenseRow(
  id: string,
  amountMinor: number,
  forProjectId: string | null = projectId,
): unknown[] {
  return [id, forProjectId, amountMinor];
}

function goldenDb() {
  return createScriptedDb((sql) => {
    if (sql.includes('from "rates"')) {
      // rates query may select full rows (profitability) — two versions as separate rows
      return [
        [
          'rate_billable_org',
          workspaceId,
          'billable',
          'org',
          null,
          null,
          null,
          10_000,
          'USD',
          new Date('2026-01-01T00:00:00.000Z'),
          null,
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-01-01T00:00:00.000Z'),
          null,
        ],
        [
          'rate_cost',
          workspaceId,
          'cost',
          'user',
          userId,
          null,
          null,
          4_000,
          'USD',
          new Date('2026-01-01T00:00:00.000Z'),
          null,
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-01-01T00:00:00.000Z'),
          null,
        ],
      ];
    }
    if (sql.includes('inner join "users"')) {
      return [
        timeRow({ id: 'te_billable', durationMinutes: 120, billable: true }),
        timeRow({ id: 'te_nonbillable', durationMinutes: 60, billable: false }),
        timeRow({
          id: 'te_open_interval',
          durationMinutes: null,
          billable: true,
          startAt: null,
          endAt: null,
        }),
        timeRow({
          id: 'te_other_project',
          durationMinutes: 30,
          billable: true,
          projectId: 'prj_other',
          projectName: 'Beta',
        }),
      ];
    }
    if (sql.includes('from "expenses"')) {
      return [expenseRow('exp_1', 5_000), expenseRow('exp_unassigned', 1_000, null)];
    }
    throw new Error(`Unexpected SQL in cost-report golden: ${sql}`);
  });
}

describe('cost-report golden fixtures', () => {
  it('matches the pinned profitability totals and groups', async () => {
    const { db } = goldenDb();
    const report = await getProfitabilityReport(
      scriptedContext(db, workspaceId, userId, 'manager'),
      query,
      'req_golden',
    );

    // hours: 120 billable + 60 nonbillable on Alpha; 30 billable on Beta; open interval skipped
    // revenue Alpha: (120/60)*10000 = 20000; Beta: 0.5*10000 = 5000
    // cost Alpha: (180/60)*4000 = 12000; Beta: (30/60)*4000 = 2000
    // expenses: Alpha 5000; unassigned 1000
    const golden = {
      from: '2026-09-01',
      to: '2026-09-30',
      timezone: 'UTC',
      groupBy: 'project',
      currency: 'USD',
      totals: {
        revenueMinor: 25_000,
        laborCostMinor: 14_000,
        expenseMinor: 6_000,
        profitMinor: 5_000,
        marginRatio: 0.2,
      },
      groups: [
        {
          id: 'prj_golden',
          name: 'Alpha',
          revenueMinor: 20_000,
          laborCostMinor: 12_000,
          expenseMinor: 5_000,
          profitMinor: 3_000,
          marginRatio: 0.15,
          totalMinutes: 180,
          billableMinutes: 120,
        },
        {
          id: 'prj_other',
          name: 'Beta',
          revenueMinor: 5_000,
          laborCostMinor: 2_000,
          expenseMinor: 0,
          profitMinor: 3_000,
          marginRatio: 0.6,
          totalMinutes: 30,
          billableMinutes: 30,
        },
        {
          id: null,
          name: 'No project',
          revenueMinor: 0,
          laborCostMinor: 0,
          expenseMinor: 1_000,
          profitMinor: -1_000,
          marginRatio: null,
          totalMinutes: 0,
          billableMinutes: 0,
        },
      ],
    };

    expect(report).toEqual(golden);
    expect(report.totals.revenueMinor).toBe(
      report.groups.reduce((sum, group) => sum + group.revenueMinor, 0),
    );
  });

  it('pins profitability CSV columns and row order', async () => {
    const { db } = goldenDb();
    const report = await getProfitabilityReport(
      scriptedContext(db, workspaceId, userId, 'manager'),
      query,
      'req_golden',
    );
    const csv = profitabilityReportCsv(report);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      '"group_type","group_id","group_name","revenue_minor","labor_cost_minor","expense_minor","profit_minor","margin_ratio","total_minutes","billable_minutes"',
    );
    expect(lines[1]).toBe(
      '"project","prj_golden","Alpha","20000","12000","5000","3000","0.15","180","120"',
    );
    expect(lines[2]).toBe('"project","prj_other","Beta","5000","2000","0","3000","0.6","30","30"');
    expect(lines[3]).toBe('"project","","No project","0","0","1000","-1000","","0","0"');
  });

  it('matches utilization totals for the same time fixture', async () => {
    const { db } = goldenDb();
    const report = await getUtilizationReport(
      scriptedContext(db, workspaceId, userId, 'manager'),
      { from: query.from, to: query.to, timezone: query.timezone, groupBy: 'project' },
      'req_golden',
    );
    expect(report.totals).toEqual({
      totalMinutes: 210,
      billableMinutes: 150,
      nonBillableMinutes: 60,
      utilizationRatio: 150 / 210,
    });
    expect(report.groups.map((group) => [group.id, group.totalMinutes])).toEqual([
      ['prj_golden', 180],
      ['prj_other', 30],
    ]);
  });

  it('rejects inverted date ranges before loading rows', async () => {
    const { db, queries } = createScriptedDb(() => []);
    await expect(
      getProfitabilityReport(
        scriptedContext(db, workspaceId, userId, 'manager'),
        { ...query, from: '2026-10-01', to: '2026-09-01' },
        'req_golden',
      ),
    ).rejects.toThrow();
    expect(queries).toHaveLength(0);
  });
});
