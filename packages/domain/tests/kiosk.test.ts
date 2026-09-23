import { describe, expect, it } from 'vite-plus/test';
import {
  isValidDeviceKey,
  isValidKioskPin,
  isValidKioskQrToken,
  resolveKioskPunchAction,
} from '../src/kiosk.ts';

describe('kiosk credentials', () => {
  it('accepts 4-8 digit PINs only', () => {
    expect(isValidKioskPin('1234')).toBe(true);
    expect(isValidKioskPin('12345678')).toBe(true);
    expect(isValidKioskPin('123')).toBe(false);
    expect(isValidKioskPin('12345a')).toBe(false);
    expect(isValidKioskPin('')).toBe(false);
  });

  it('validates QR token shape', () => {
    expect(isValidKioskQrToken('a'.repeat(32))).toBe(true);
    expect(isValidKioskQrToken('short')).toBe(false);
    expect(isValidKioskQrToken('!'.repeat(32))).toBe(false);
  });

  it('validates high-entropy device keys', () => {
    expect(isValidDeviceKey('k'.repeat(32))).toBe(true);
    expect(isValidDeviceKey('k'.repeat(16))).toBe(false);
  });

  it('toggles punch action from open state', () => {
    expect(resolveKioskPunchAction(false)).toBe('clock_in');
    expect(resolveKioskPunchAction(true)).toBe('clock_out');
  });
});
