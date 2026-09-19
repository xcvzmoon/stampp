export type DurationMinutes = number;

export function minutesBetween(startAt: Date, endAt: Date): DurationMinutes {
  const diffMs = endAt.getTime() - startAt.getTime();
  if (diffMs < 0) {
    throw new RangeError('endAt must be after startAt');
  }
  return Math.floor(diffMs / 60_000);
}

export function addMinutes(startAt: Date, minutes: DurationMinutes): Date {
  assertNonNegativeInteger(minutes, 'minutes');
  return new Date(startAt.getTime() + minutes * 60_000);
}

export function isValidDurationMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!isValidDurationMinutes(value)) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}
