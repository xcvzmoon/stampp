import type { AuthorizedContext } from '@stampp/access';
import type {
  DetailedReport,
  DetailedReportEntry,
  ReportQuery,
  ReportTotals,
  SummaryReport,
  WeeklyReport,
} from '@stampp/shared';
import { clients, projects, timeEntries, users } from '@stampp/database';
import { ERROR_CODES, reportQuerySchema } from '@stampp/shared';
import { and, asc, eq, gte, isNotNull, isNull, lt, lte, or } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { addCalendarDays, calendarDateInTimezone } from '~/server/utils/week.ts';

type ReportRow = {
  id: string;
  userId: string;
  userName: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  description: string;
  billable: boolean;
  startAt: Date | null;
  endAt: Date | null;
  durationMinutes: number | null;
  workDate: string;
};

type MutableTotals = ReportTotals;

function dateTimeParts(date: Date, timezone: string): number[] {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = new Map<string, number>();
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') values.set(part.type, Number(part.value));
  }
  return [
    values.get('year') ?? 0,
    values.get('month') ?? 0,
    values.get('day') ?? 0,
    values.get('hour') ?? 0,
    values.get('minute') ?? 0,
    values.get('second') ?? 0,
  ];
}

export function startOfCalendarDate(date: string, timezone: string): Date {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [actualYear, actualMonth, actualDay, hour, minute, second] = dateTimeParts(
      new Date(candidate),
      timezone,
    );
    const actual = Date.UTC(actualYear, actualMonth - 1, actualDay, hour, minute, second);
    const correction = target - actual;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

export function parseReportQuery(query: URLSearchParams, requestId: string): ReportQuery {
  const raw: Record<string, string> = {};
  for (const key of [
    'from',
    'to',
    'timezone',
    'projectId',
    'clientId',
    'userId',
    'billable',
    'groupBy',
    'format',
  ]) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(reportQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Report query failed validation',
      requestId,
      result.issues,
    );
  }
  if (result.output.from > result.output.to) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'from must not be after to', requestId);
  }
  return result.output;
}

function emptyTotals(): MutableTotals {
  return { totalMinutes: 0, billableMinutes: 0, nonBillableMinutes: 0 };
}

function entryMinutes(row: ReportRow): number {
  if (row.durationMinutes !== null) return row.durationMinutes;
  if (!row.startAt || !row.endAt) return 0;
  return Math.max(0, Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60_000));
}

function addMinutes(totals: MutableTotals, minutes: number, billable: boolean): void {
  totals.totalMinutes += minutes;
  if (billable) totals.billableMinutes += minutes;
  else totals.nonBillableMinutes += minutes;
}

function entryDate(row: ReportRow, timezone: string): string {
  return row.startAt ? calendarDateInTimezone(row.startAt, timezone) : row.workDate;
}

export function reportScope(ctx: AuthorizedContext, query: ReportQuery) {
  const intervalStart = startOfCalendarDate(query.from, query.timezone);
  const intervalEnd = startOfCalendarDate(addCalendarDays(query.to, 1), query.timezone);
  const conditions = [
    eq(timeEntries.workspaceId, ctx.workspaceId),
    or(
      and(
        isNotNull(timeEntries.durationMinutes),
        gte(timeEntries.workDate, query.from),
        lte(timeEntries.workDate, query.to),
      ),
      and(
        isNull(timeEntries.durationMinutes),
        isNotNull(timeEntries.endAt),
        gte(timeEntries.startAt, intervalStart),
        lt(timeEntries.startAt, intervalEnd),
      ),
    ),
  ];
  if (ctx.role === 'member') conditions.push(eq(timeEntries.userId, ctx.userId));
  if (query.projectId) conditions.push(eq(timeEntries.projectId, query.projectId));
  if (query.clientId) conditions.push(eq(projects.clientId, query.clientId));
  if (query.userId) conditions.push(eq(timeEntries.userId, query.userId));
  if (query.billable) conditions.push(eq(timeEntries.billable, query.billable === 'true'));
  return and(...conditions);
}

export async function loadReportRows(
  ctx: AuthorizedContext,
  query: ReportQuery,
): Promise<ReportRow[]> {
  return ctx.db.client
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      userName: users.name,
      clientId: clients.id,
      clientName: clients.name,
      projectId: projects.id,
      projectName: projects.name,
      description: timeEntries.description,
      billable: timeEntries.billable,
      startAt: timeEntries.startAt,
      endAt: timeEntries.endAt,
      durationMinutes: timeEntries.durationMinutes,
      workDate: timeEntries.workDate,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(
      projects,
      and(eq(projects.id, timeEntries.projectId), eq(projects.workspaceId, ctx.workspaceId)),
    )
    .leftJoin(
      clients,
      and(eq(clients.id, projects.clientId), eq(clients.workspaceId, ctx.workspaceId)),
    )
    .where(reportScope(ctx, query))
    .orderBy(asc(timeEntries.workDate), asc(timeEntries.startAt), asc(timeEntries.id));
}

export function buildSummaryReport(rows: ReportRow[], query: ReportQuery): SummaryReport {
  const groupBy = query.groupBy ?? 'project';
  const totals = emptyTotals();
  const grouped = new Map<string, { id: string | null; name: string; totals: MutableTotals }>();
  for (const row of rows) {
    const minutes = entryMinutes(row);
    addMinutes(totals, minutes, row.billable);
    const id =
      groupBy === 'project' ? row.projectId : groupBy === 'client' ? row.clientId : row.userId;
    const name =
      groupBy === 'project'
        ? (row.projectName ?? 'No project')
        : groupBy === 'client'
          ? (row.clientName ?? 'No client')
          : row.userName;
    const key = id ?? `none:${groupBy}`;
    let group = grouped.get(key);
    if (!group) {
      group = { id, name, totals: emptyTotals() };
      grouped.set(key, group);
    }
    addMinutes(group.totals, minutes, row.billable);
  }
  const unsortedGroups: SummaryReport['groups'] = [];
  for (const group of grouped.values()) {
    unsortedGroups.push({
      id: group.id,
      name: group.name,
      totalMinutes: group.totals.totalMinutes,
      billableMinutes: group.totals.billableMinutes,
      nonBillableMinutes: group.totals.nonBillableMinutes,
    });
  }
  const groups = unsortedGroups.toSorted(
    (left, right) =>
      left.name.localeCompare(right.name) || (left.id ?? '').localeCompare(right.id ?? ''),
  );
  return { from: query.from, to: query.to, timezone: query.timezone, groupBy, totals, groups };
}

export function buildDetailedReport(rows: ReportRow[], query: ReportQuery): DetailedReport {
  const totals = emptyTotals();
  const entries: DetailedReportEntry[] = [];
  for (const row of rows) {
    const minutes = entryMinutes(row);
    addMinutes(totals, minutes, row.billable);
    entries.push({
      id: row.id,
      date: entryDate(row, query.timezone),
      userId: row.userId,
      userName: row.userName,
      clientId: row.clientId,
      clientName: row.clientName,
      projectId: row.projectId,
      projectName: row.projectName,
      description: row.description,
      billable: row.billable,
      minutes,
      startAt: row.startAt?.toISOString() ?? null,
      endAt: row.endAt?.toISOString() ?? null,
    });
  }
  const sortedEntries = entries.toSorted(
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
  return {
    from: query.from,
    to: query.to,
    timezone: query.timezone,
    totals,
    entries: sortedEntries,
  };
}

function mondayForCalendarDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  return addCalendarDays(date, -offset);
}

export function buildWeeklyReport(rows: ReportRow[], query: ReportQuery): WeeklyReport {
  const totals = emptyTotals();
  const grouped = new Map<string, MutableTotals>();
  for (const row of rows) {
    const minutes = entryMinutes(row);
    addMinutes(totals, minutes, row.billable);
    const weekStart = mondayForCalendarDate(entryDate(row, query.timezone));
    let weekTotals = grouped.get(weekStart);
    if (!weekTotals) {
      weekTotals = emptyTotals();
      grouped.set(weekStart, weekTotals);
    }
    addMinutes(weekTotals, minutes, row.billable);
  }
  const weeks: WeeklyReport['weeks'] = [];
  for (const [weekStart, weekTotals] of [...grouped.entries()].toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    weeks.push({
      weekStart,
      weekEnd: addCalendarDays(weekStart, 6),
      totalMinutes: weekTotals.totalMinutes,
      billableMinutes: weekTotals.billableMinutes,
      nonBillableMinutes: weekTotals.nonBillableMinutes,
    });
  }
  return { from: query.from, to: query.to, timezone: query.timezone, totals, weeks };
}

function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value);
  // Prefix formula-leading values so spreadsheets do not execute cell content.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

type CsvValue = string | number | boolean | null;

function csv(rows: CsvValue[][]): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function summaryReportCsv(report: SummaryReport): string {
  const rows: CsvValue[][] = [
    [
      'group_type',
      'group_id',
      'group_name',
      'total_minutes',
      'billable_minutes',
      'non_billable_minutes',
    ],
  ];
  for (const group of report.groups) {
    rows.push([
      report.groupBy,
      group.id,
      group.name,
      group.totalMinutes,
      group.billableMinutes,
      group.nonBillableMinutes,
    ]);
  }
  return csv(rows);
}

export function detailedReportCsv(report: DetailedReport): string {
  const rows: CsvValue[][] = [
    [
      'entry_id',
      'date',
      'user_id',
      'user_name',
      'client_id',
      'client_name',
      'project_id',
      'project_name',
      'description',
      'billable',
      'minutes',
      'start_at',
      'end_at',
    ],
  ];
  for (const entry of report.entries) {
    rows.push([
      entry.id,
      entry.date,
      entry.userId,
      entry.userName,
      entry.clientId,
      entry.clientName,
      entry.projectId,
      entry.projectName,
      entry.description,
      entry.billable,
      entry.minutes,
      entry.startAt,
      entry.endAt,
    ]);
  }
  return csv(rows);
}

export function weeklyReportCsv(report: WeeklyReport): string {
  const rows: CsvValue[][] = [
    ['week_start', 'week_end', 'total_minutes', 'billable_minutes', 'non_billable_minutes'],
  ];
  for (const week of report.weeks) {
    rows.push([
      week.weekStart,
      week.weekEnd,
      week.totalMinutes,
      week.billableMinutes,
      week.nonBillableMinutes,
    ]);
  }
  return csv(rows);
}
