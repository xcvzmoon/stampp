export const DEFAULT_WEEKLY_CAPACITY_HOURS = 40;

export type WorkloadStatus = 'overbooked' | 'on_track' | 'underutilized' | 'unscheduled';

export type WorkloadInput = {
  capacityHours: number;
  scheduledHours: number;
  trackedHours: number;
};

export type WorkloadSummary = WorkloadInput & {
  status: WorkloadStatus;
  scheduleVarianceHours: number;
  capacityVarianceHours: number;
};

export function isValidScheduleRange(startDate: string, endDate: string): boolean {
  return isValidCalendarDate(startDate) && isValidCalendarDate(endDate) && startDate <= endDate;
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidWeeklyHours(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 168;
}

/** True when the assignment span includes any day in the inclusive week. */
export function assignmentCoversRange(
  assignmentStart: string,
  assignmentEnd: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return assignmentStart <= rangeEnd && assignmentEnd >= rangeStart;
}

/**
 * Classify scheduled vs tracked against weekly capacity.
 * Overbooked: schedule exceeds capacity.
 * Unscheduled: no assignments, but tracked time exists (or neither).
 * Underutilized: scheduled or capacity exists but tracked is well below both.
 */
export function resolveWorkload(input: WorkloadInput): WorkloadSummary {
  const scheduleVarianceHours = roundHours(input.scheduledHours - input.trackedHours);
  const capacityVarianceHours = roundHours(input.capacityHours - input.trackedHours);

  let status: WorkloadStatus;
  if (input.scheduledHours > input.capacityHours) {
    status = 'overbooked';
  } else if (input.scheduledHours <= 0 && input.trackedHours <= 0) {
    status = 'unscheduled';
  } else if (input.scheduledHours <= 0 && input.trackedHours > 0) {
    status = 'on_track';
  } else if (
    input.trackedHours + 0.01 <
    Math.min(input.scheduledHours, input.capacityHours) * 0.5
  ) {
    status = 'underutilized';
  } else {
    status = 'on_track';
  }

  return {
    capacityHours: roundHours(input.capacityHours),
    scheduledHours: roundHours(input.scheduledHours),
    trackedHours: roundHours(input.trackedHours),
    status,
    scheduleVarianceHours,
    capacityVarianceHours,
  };
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function minutesToHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError('minutes must be a non-negative number');
  }
  return roundHours(minutes / 60);
}
