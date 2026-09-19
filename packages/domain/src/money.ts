export type CurrencyCode = string;

/** Integer minor units. Never floats. */
export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

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

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function multiplyMoney(a: Money, factor: number): Money {
  return money(Math.round(a.amountMinor * factor), a.currency);
}

export function isZeroMoney(value: Money): boolean {
  return value.amountMinor === 0;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new RangeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}
