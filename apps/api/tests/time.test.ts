import type { TimeEntry } from '@stampp/database';
import { createTestDb, timeEntries } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { HTTPError } from 'nitro';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '../server/utils/errors.ts';
import { parseTimeEntryListQuery, parseWeeklyTimeQuery } from '../server/utils/time.ts';
import { buildWeeklyTimeSummary, weeklyTimeScope } from '../server/utils/timeTracking.ts';
import { calendarDateInTimezone } from '../server/utils/week.ts';

const requestId = 'req_time';

describe('parseTimeEntryListQuery', () => {
  it('applies the default limit and preserves supported filters', () => {
    const query = parseTimeEntryListQuery(
      new URLSearchParams({
        cursor: 'te_1',
        projectId: 'prj_1',
        from: '2026-09-01T00:00:00.000Z',
      }),
      requestId,
    );
    expect(query.limit).toBe(50);
    expect(query.cursor).toBe('te_1');
    expect(query.projectId).toBe('prj_1');
  });

  it('rejects inverted date ranges with a stable error code', () => {
    try {
      parseTimeEntryListQuery(
        new URLSearchParams({
          from: '2026-09-30T00:00:00.000Z',
          to: '2026-09-01T00:00:00.000Z',
        }),
        requestId,
      );
      throw new Error('expected date range rejection');
    } catch (error) {
      if (!(error instanceof HTTPError)) throw error;
      expect(error.status).toBe(400);
      expect(error.data).toMatchObject({ code: ERROR_CODES.BAD_REQUEST });
    }
  });
});

describe('time-entry error statuses', () => {
  it('maps concurrency and lock failures to distinct HTTP statuses', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.TIMER_ALREADY_RUNNING)).toBe(409);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_ENTRY_OVERLAP)).toBe(409);
    expect(mapErrorCodeToStatus(ERROR_CODES.TIME_ENTRY_LOCKED)).toBe(423);
  });
});

describe('weekly time query', () => {
  it('requires a Monday and a valid IANA timezone', () => {
    expect(
      parseWeeklyTimeQuery(
        new URLSearchParams({ weekStart: '2026-09-14', timezone: 'Asia/Manila' }),
        requestId,
      ),
    ).toEqual({ weekStart: '2026-09-14', timezone: 'Asia/Manila' });

    for (const params of [
      { weekStart: '2026-09-15', timezone: 'UTC' },
      { weekStart: '2026-09-14', timezone: 'Mars/Olympus' },
    ]) {
      expect(() => parseWeeklyTimeQuery(new URLSearchParams(params), requestId)).toThrow(HTTPError);
    }
  });

  it('assigns boundary instants to the selected timezone calendar date', () => {
    const instant = new Date('2026-09-20T16:30:00.000Z');
    expect(calendarDateInTimezone(instant, 'Asia/Manila')).toBe('2026-09-21');
    expect(calendarDateInTimezone(instant, 'America/Los_Angeles')).toBe('2026-09-20');
  });
});

function timeEntry(
  id: string,
  projectId: string | null,
  workDate: string,
  durationMinutes: number | null,
  startAt: Date | null = null,
  endAt: Date | null = null,
): TimeEntry {
  const timestamp = new Date('2026-09-14T00:00:00.000Z');
  return {
    id,
    workspaceId: 'ws_1',
    userId: 'user_1',
    projectId,
    taskId: null,
    description: '',
    billable: true,
    startAt,
    endAt,
    durationMinutes,
    workDate,
    timezone: 'America/New_York',
    lockedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

describe('weekly time summary', () => {
  it('groups projects and calculates daily, weekly, expected, and missing totals', () => {
    const rows = [
      timeEntry('te_1', 'prj_1', '2026-10-26', 90),
      timeEntry(
        'te_2',
        'prj_2',
        '2026-11-01',
        null,
        new Date('2026-11-01T05:30:00.000Z'),
        new Date('2026-11-01T07:30:00.000Z'),
      ),
    ];
    const summary = buildWeeklyTimeSummary(
      rows,
      { weekStart: '2026-10-26', timezone: 'America/New_York' },
      new Date('2026-11-02T00:00:00.000Z'),
    );

    expect(summary.days.map((day) => day.totalMinutes)).toEqual([90, 0, 0, 0, 0, 0, 120]);
    expect(summary.projects.map((project) => project.totalMinutes)).toEqual([90, 120]);
    expect(summary.totalMinutes).toBe(210);
    expect(summary.expectedMinutes).toBe(2400);
    expect(summary.missingMinutes).toBe(2190);
    expect(summary.days[6]?.expectedMinutes).toBe(0);
  });

  it('never reports negative missing time for overtime', () => {
    const summary = buildWeeklyTimeSummary(
      [timeEntry('te_1', null, '2026-09-14', 3000)],
      { weekStart: '2026-09-14', timezone: 'UTC' },
      new Date('2026-09-14T00:00:00.000Z'),
    );
    expect(summary.missingMinutes).toBe(0);
    expect(summary.days[0]?.missingMinutes).toBe(0);
  });
});

describe('weekly time workspace isolation', () => {
  it('binds workspace, user, and both date bounds into the database query', () => {
    const db = createTestDb();
    const query = db
      .select()
      .from(timeEntries)
      .where(weeklyTimeScope('ws_target', 'user_target', '2026-09-14', '2026-09-20'))
      .toSQL();
    expect(query.params).toEqual(['ws_target', 'user_target', '2026-09-14', '2026-09-20']);
    expect(query.sql).toContain('"workspace_id" = $1');
    expect(query.sql).toContain('"user_id" = $2');
  });
});
