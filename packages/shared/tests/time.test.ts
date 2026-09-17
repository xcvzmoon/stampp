import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import {
  addManualTimeInputSchema,
  startTimerInputSchema,
  timeEntryListQuerySchema,
  updateTimeEntryInputSchema,
  weeklyTimeQuerySchema,
} from '../src/time.ts';

describe('time input schemas', () => {
  it('requires a timezone when starting a timer', () => {
    expect(v.safeParse(startTimerInputSchema, { timezone: 'Asia/Manila' }).success).toBe(true);
    expect(v.safeParse(startTimerInputSchema, {}).success).toBe(false);
    expect(v.safeParse(startTimerInputSchema, { timezone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('accepts manual intervals and fixed durations', () => {
    expect(
      v.safeParse(addManualTimeInputSchema, {
        kind: 'interval',
        startAt: '2026-09-17T08:00:00.000Z',
        endAt: '2026-09-17T09:00:00.000Z',
        timezone: 'UTC',
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(addManualTimeInputSchema, {
        kind: 'duration',
        durationMinutes: 60,
        workDate: '2026-09-17',
        timezone: 'UTC',
      }).success,
    ).toBe(true);
  });

  it('rejects zero, negative, and fractional duration entries', () => {
    for (const durationMinutes of [0, -1, 1.5]) {
      expect(
        v.safeParse(addManualTimeInputSchema, {
          kind: 'duration',
          durationMinutes,
          timezone: 'UTC',
        }).success,
      ).toBe(false);
    }
  });

  it('rejects incomplete interval payloads', () => {
    expect(
      v.safeParse(addManualTimeInputSchema, {
        kind: 'interval',
        startAt: '2026-09-17T08:00:00.000Z',
        timezone: 'UTC',
      }).success,
    ).toBe(false);
  });

  it('accepts explicit nulls when clearing assignments', () => {
    expect(v.safeParse(updateTimeEntryInputSchema, { projectId: null, taskId: null }).success).toBe(
      true,
    );
  });
});

describe('weekly time schemas', () => {
  it('accepts calendar dates and rejects impossible dates and timestamps', () => {
    expect(
      v.safeParse(weeklyTimeQuerySchema, {
        weekStart: '2026-09-14',
        timezone: 'Asia/Manila',
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(weeklyTimeQuerySchema, { weekStart: '2026-02-30', timezone: 'UTC' }).success,
    ).toBe(false);
    expect(
      v.safeParse(weeklyTimeQuerySchema, {
        weekStart: '2026-09-14T00:00:00.000Z',
        timezone: 'UTC',
      }).success,
    ).toBe(false);
  });
});

describe('time-entry list query schema', () => {
  it('parses bounded limits and ISO date filters', () => {
    const result = v.safeParse(timeEntryListQuerySchema, {
      limit: '100',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output.limit).toBe(100);
  });

  it('rejects limits outside the API bounds', () => {
    expect(v.safeParse(timeEntryListQuerySchema, { limit: '0' }).success).toBe(false);
    expect(v.safeParse(timeEntryListQuerySchema, { limit: '201' }).success).toBe(false);
  });
});
