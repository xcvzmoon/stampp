/** Whole minutes. Fractions are not valid durations in Stampp. */
export type DurationMinutes = number;

/**
 * Whole minutes between two instants, floored.
 *
 * @throws {RangeError} When `endAt` is before `startAt`.
 *
 * @example
 * ```ts
 * minutesBetween(
 *   new Date('2026-01-01T09:00:00.000Z'),
 *   new Date('2026-01-01T10:30:00.000Z'),
 * ); // 90
 *
 * minutesBetween(
 *   new Date('2026-01-01T09:00:00.000Z'),
 *   new Date('2026-01-01T09:00:59.999Z'),
 * ); // 0
 * ```
 */
export function minutesBetween(startAt: Date, endAt: Date): DurationMinutes {
  const diffMs = endAt.getTime() - startAt.getTime();
  if (diffMs < 0) {
    throw new RangeError('endAt must be after startAt');
  }
  return Math.floor(diffMs / 60_000);
}

/**
 * Adds minutes to a start instant.
 *
 * @throws {RangeError} When `minutes` is negative or not an integer.
 *
 * @example
 * ```ts
 * addMinutes(new Date('2026-01-01T09:00:00.000Z'), 90);
 * // Date('2026-01-01T10:30:00.000Z')
 * ```
 */
export function addMinutes(startAt: Date, minutes: DurationMinutes): Date {
  assertNonNegativeInteger(minutes, 'minutes');
  return new Date(startAt.getTime() + minutes * 60_000);
}

/**
 * True for non-negative integers (including zero). Rejects NaN and Infinity.
 *
 * @example
 * ```ts
 * isValidDurationMinutes(0); // true
 * isValidDurationMinutes(1.5); // false
 * isValidDurationMinutes(-1); // false
 * ```
 */
export function isValidDurationMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!isValidDurationMinutes(value)) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}
