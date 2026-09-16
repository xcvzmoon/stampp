import { describe, expect, it } from 'vite-plus/test';
import { addMoney, isZeroMoney, money, multiplyMoney, subtractMoney } from '../src/money.ts';

describe('money', () => {
  describe('construction', () => {
    it('normalizes currency to uppercase', () => {
      expect(money(1000, 'usd')).toEqual({ amountMinor: 1000, currency: 'USD' });
    });

    it('accepts zero minor units', () => {
      expect(money(0, 'EUR').amountMinor).toBe(0);
    });

    it('accepts negative minor units for credits/adjustments', () => {
      expect(money(-250, 'USD').amountMinor).toBe(-250);
    });

    it('rejects non-integer minor units', () => {
      expect(() => money(10.5, 'USD')).toThrow(RangeError);
    });

    it('rejects currency codes that are not 3 letters', () => {
      expect(() => money(100, 'US')).toThrow(RangeError);
      expect(() => money(100, 'USDT')).toThrow(RangeError);
      expect(() => money(100, '')).toThrow(RangeError);
    });
  });

  describe('arithmetic', () => {
    it('adds same-currency amounts', () => {
      expect(addMoney(money(1500, 'USD'), money(500, 'USD')).amountMinor).toBe(2000);
    });

    it('subtracts same-currency amounts', () => {
      expect(subtractMoney(money(1500, 'USD'), money(500, 'USD')).amountMinor).toBe(1000);
    });

    it('rejects addition across currencies', () => {
      expect(() => addMoney(money(1, 'USD'), money(1, 'EUR'))).toThrow(RangeError);
    });

    it('rejects subtraction across currencies', () => {
      expect(() => subtractMoney(money(1, 'USD'), money(1, 'EUR'))).toThrow(RangeError);
    });

    it('rounds multiply half away from zero to nearest minor unit', () => {
      expect(multiplyMoney(money(100, 'USD'), 1.125).amountMinor).toBe(113);
      expect(multiplyMoney(money(100, 'USD'), 1.124).amountMinor).toBe(112);
    });

    it('preserves currency when multiplying', () => {
      expect(multiplyMoney(money(100, 'JPY'), 2).currency).toBe('JPY');
    });
  });

  describe('isZeroMoney', () => {
    it('is true only for zero minor units', () => {
      expect(isZeroMoney(money(0, 'USD'))).toBe(true);
      expect(isZeroMoney(money(1, 'USD'))).toBe(false);
    });
  });
});
