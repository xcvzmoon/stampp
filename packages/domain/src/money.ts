/** ISO 4217 alphabetic code, always stored uppercase. */
export type CurrencyCode = string;

/**
 * Money as integer minor units. Never use floats for currency.
 *
 * @example
 * ```ts
 * const price = money(1999, 'USD'); // $19.99
 * ```
 */
export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

/**
 * Builds a {@link Money} value.
 *
 * @throws {RangeError} When `amountMinor` is not an integer or `currency` is not three letters.
 *
 * @example
 * ```ts
 * money(1500, 'usd');
 * // { amountMinor: 1500, currency: 'USD' }
 *
 * money(-250, 'eur');
 * // { amountMinor: -250, currency: 'EUR' }
 * ```
 */
export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new RangeError('Money amount must be integer minor units');
  }
  if (currency.length !== 3) {
    throw new RangeError('Currency must be a 3-letter ISO 4217 code');
  }
  return {
    amountMinor,
    currency: currency.toUpperCase(),
  };
}

/**
 * Adds two amounts in the same currency.
 *
 * @throws {RangeError} When currencies differ.
 *
 * @example
 * ```ts
 * addMoney(money(1500, 'USD'), money(500, 'USD')).amountMinor; // 2000
 * ```
 */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

/**
 * Subtracts `b` from `a` in the same currency.
 *
 * @throws {RangeError} When currencies differ.
 *
 * @example
 * ```ts
 * subtractMoney(money(1500, 'USD'), money(500, 'USD')).amountMinor; // 1000
 * ```
 */
export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/**
 * Multiplies by a scalar and rounds to the nearest minor unit.
 *
 * @example
 * ```ts
 * multiplyMoney(money(100, 'USD'), 1.125).amountMinor; // 113
 * ```
 */
export function multiplyMoney(a: Money, factor: number): Money {
  return money(Math.round(a.amountMinor * factor), a.currency);
}

/**
 * True when the amount is exactly zero.
 *
 * @example
 * ```ts
 * isZeroMoney(money(0, 'USD')); // true
 * isZeroMoney(money(1, 'USD')); // false
 * ```
 */
export function isZeroMoney(value: Money): boolean {
  return value.amountMinor === 0;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new RangeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}
