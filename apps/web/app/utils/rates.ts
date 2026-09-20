const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK']);

export function currencyDecimalDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase()) ? 0 : 2;
}

export function majorToMinor(major: number, currency: string): number {
  const factor = 10 ** currencyDecimalDigits(currency);
  return Math.round(major * factor);
}

export function minorToMajorString(amountMinor: number, currency: string): string {
  const digits = currencyDecimalDigits(currency);
  const factor = 10 ** digits;
  return (amountMinor / factor).toFixed(digits);
}

export function formatRateAmount(amountMinor: number, currency: string): string {
  return `${minorToMajorString(amountMinor, currency)} ${currency.toUpperCase()}`;
}
