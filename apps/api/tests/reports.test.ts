import type { AuthorizedContext } from '@stampp/access';
import type { Db } from '@stampp/database';
import type { ReportQuery } from '@stampp/shared';
import { createScopedDb, createTestDb, timeEntries } from '@stampp/database';
import { resolveActorPermissions } from '@stampp/domain';
import { HTTPError } from 'nitro';
import { describe, expect, it } from 'vite-plus/test';
import {
  buildDetailedReport,
  buildSummaryReport,
  buildWeeklyReport,
  detailedReportCsv,
  parseReportQuery,
  reportScope,
  startOfCalendarDate,
  summaryReportCsv,
  weeklyReportCsv,
} from '~/server/utils/reports.ts';

const baseQuery: ReportQuery = {
  from: '2026-10-25',
  to: '2026-11-07',
  timezone: 'America/New_York',
};

function context(
  db: Db,
  role: AuthorizedContext['role'] = { kind: 'builtin', role: 'manager' },
): AuthorizedContext {
  return {
    userId: 'user_actor',
    workspaceId: 'ws_target',
    role,
    permissions: resolveActorPermissions(role),
    db: createScopedDb(db, 'ws_target'),
  };
}

function row(
  id: string,
  minutes: number,
  billable: boolean,
  projectId: string | null = 'prj_1',
  projectName: string | null = 'Alpha',
) {
  return {
    id,
    userId: 'user_1',
    userName: 'Ada',
    clientId: projectId ? 'cli_1' : null,
    clientName: projectId ? 'Acme' : null,
    projectId,
    projectName,
    description: 'Work',
    billable,
    startAt: null,
    endAt: null,
    durationMinutes: minutes,
    workDate: '2026-10-26',
  };
}

describe('report query', () => {
  it('accepts all supported filters', () => {
    const query = parseReportQuery(
      new URLSearchParams({
        from: '2026-01-01',
        to: '2026-01-31',
        timezone: 'Asia/Manila',
        projectId: 'prj_1',
        clientId: 'cli_1',
        userId: 'user_1',
        billable: 'false',
        groupBy: 'user',
        format: 'csv',
      }),
      'req_reports',
    );
    expect(query).toMatchObject({ billable: 'false', groupBy: 'user', format: 'csv' });
  });

  it('rejects invalid timezones and inverted ranges', () => {
    for (const params of [
      { from: '2026-01-02', to: '2026-01-01', timezone: 'UTC' },
      { from: '2026-01-01', to: '2026-01-02', timezone: 'Mars/Olympus' },
    ]) {
      expect(() => parseReportQuery(new URLSearchParams(params), 'req_reports')).toThrow(HTTPError);
    }
  });
});

describe('timezone boundaries', () => {
  it('uses the offset active at each date across spring DST', () => {
    const start = startOfCalendarDate('2026-03-08', 'America/New_York');
    const end = startOfCalendarDate('2026-03-09', 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('uses the offset active at each date across autumn DST', () => {
    const start = startOfCalendarDate('2026-11-01', 'America/New_York');
    const end = startOfCalendarDate('2026-11-02', 'America/New_York');
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
  });
});

describe('report aggregation', () => {
  it('calculates total and billable splits with deterministic groups', () => {
    const report = buildSummaryReport(
      [row('te_1', 30, true), row('te_2', 45, false), row('te_3', 20, true, null, null)],
      baseQuery,
    );
    expect(report.totals).toEqual({
      totalMinutes: 95,
      billableMinutes: 50,
      nonBillableMinutes: 45,
    });
    expect(report.groups).toEqual([
      {
        id: 'prj_1',
        name: 'Alpha',
        totalMinutes: 75,
        billableMinutes: 30,
        nonBillableMinutes: 45,
      },
      {
        id: null,
        name: 'No project',
        totalMinutes: 20,
        billableMinutes: 20,
        nonBillableMinutes: 0,
      },
    ]);
  });

  it('groups by client and user without losing unassigned work', () => {
    const rows = [row('te_1', 30, true), row('te_2', 20, false, null, null)];
    expect(buildSummaryReport(rows, { ...baseQuery, groupBy: 'client' }).groups).toHaveLength(2);
    expect(buildSummaryReport(rows, { ...baseQuery, groupBy: 'user' }).groups).toEqual([
      {
        id: 'user_1',
        name: 'Ada',
        totalMinutes: 50,
        billableMinutes: 30,
        nonBillableMinutes: 20,
      },
    ]);
  });

  it('uses elapsed instants through a repeated DST hour', () => {
    const entry = {
      ...row('te_dst', 0, true),
      durationMinutes: null,
      startAt: new Date('2026-11-01T05:30:00.000Z'),
      endAt: new Date('2026-11-01T07:30:00.000Z'),
    };
    const report = buildDetailedReport([entry], baseQuery);
    expect(report.entries[0]?.minutes).toBe(120);
    expect(report.entries[0]?.date).toBe('2026-11-01');
  });

  it('places entries into Monday-based weeks in the selected timezone', () => {
    const sunday = {
      ...row('te_1', 60, true),
      workDate: '2026-11-01',
    };
    const monday = {
      ...row('te_2', 30, false),
      workDate: '2026-11-02',
    };
    const report = buildWeeklyReport([sunday, monday], baseQuery);
    expect(report.weeks.map((week) => [week.weekStart, week.totalMinutes])).toEqual([
      ['2026-10-26', 60],
      ['2026-11-02', 30],
    ]);
  });
});

describe('report isolation', () => {
  it('always scopes the database predicate to the workspace and every filter', () => {
    const db = createTestDb();
    const query = db
      .select()
      .from(timeEntries)
      .where(
        reportScope(context(db), {
          ...baseQuery,
          projectId: 'prj_target',
          clientId: 'cli_target',
          userId: 'user_target',
          billable: 'true',
        }),
      )
      .toSQL();
    expect(query.params).toContain('ws_target');
    expect(query.params).toContain('prj_target');
    expect(query.params).toContain('cli_target');
    expect(query.params).toContain('user_target');
    expect(query.sql).toContain('"workspace_id"');
  });

  it('limits members to their own entries while managers can report across users', () => {
    const db = createTestDb();
    const memberQuery = db
      .select()
      .from(timeEntries)
      .where(reportScope(context(db, { kind: 'builtin', role: 'member' }), baseQuery))
      .toSQL();
    const managerQuery = db
      .select()
      .from(timeEntries)
      .where(reportScope(context(db, { kind: 'builtin', role: 'manager' }), baseQuery))
      .toSQL();
    expect(memberQuery.params).toContain('user_actor');
    expect(managerQuery.params).not.toContain('user_actor');
  });
});

describe('CSV reports', () => {
  it('keeps stable summary columns and escapes quotes, commas, and formulas', () => {
    const report = buildSummaryReport(
      [row('te_1', 30, true, 'prj_1', '=SUM(1,2) "quoted"')],
      baseQuery,
    );
    const output = summaryReportCsv(report);
    expect(output.split('\r\n')[0]).toBe(
      '"group_type","group_id","group_name","total_minutes","billable_minutes","non_billable_minutes"',
    );
    expect(output).toContain('"\'=SUM(1,2) ""quoted"""');
  });

  it('escapes multiline detailed descriptions and protects every dangerous prefix', () => {
    for (const description of ['+cmd', '-1+2', '@link', '\tformula', '\rformula']) {
      const report = buildDetailedReport([{ ...row('te_1', 15, false), description }], baseQuery);
      expect(detailedReportCsv(report)).toContain(`"'${description.replaceAll('"', '""')}"`);
    }
    const multiline = buildDetailedReport(
      [{ ...row('te_2', 10, true), description: 'line one,\n"line two"' }],
      baseQuery,
    );
    expect(detailedReportCsv(multiline)).toContain('"line one,\n""line two"""');
  });

  it('uses stable weekly columns and CRLF row endings', () => {
    const report = buildWeeklyReport([row('te_1', 45, true)], baseQuery);
    const output = weeklyReportCsv(report);
    expect(output).toBe(
      '"week_start","week_end","total_minutes","billable_minutes","non_billable_minutes"\r\n' +
        '"2026-10-26","2026-11-01","45","45","0"\r\n',
    );
  });
});
