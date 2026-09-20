import { describe, expect, it } from 'vite-plus/test';
import {
  currencyDecimalDigits,
  formatRateAmount,
  majorToMinor,
  minorToMajorString,
} from '../app/utils/rates.ts';

describe('rates amount helpers', () => {
  it('uses two decimals for common currencies', () => {
    expect(currencyDecimalDigits('USD')).toBe(2);
    expect(currencyDecimalDigits('eur')).toBe(2);
  });

  it('uses zero decimals for JPY', () => {
    expect(currencyDecimalDigits('JPY')).toBe(0);
  });

  it('converts major units to minor units', () => {
    expect(majorToMinor(100, 'USD')).toBe(10_000);
    expect(majorToMinor(99.99, 'USD')).toBe(9_999);
    expect(majorToMinor(1500, 'JPY')).toBe(1_500);
  });

  it('formats minor units for display', () => {
    expect(minorToMajorString(10_000, 'USD')).toBe('100.00');
    expect(formatRateAmount(12_500, 'usd')).toBe('125.00 USD');
    expect(formatRateAmount(1_500, 'JPY')).toBe('1500 JPY');
  });
});
