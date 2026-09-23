/** Kiosk only clocks attendance (never project time). */
export type KioskAuthMethod = 'pin' | 'qr';

export function isValidKioskPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function isValidKioskQrToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export type KioskPunchAction = 'clock_in' | 'clock_out';

export function resolveKioskPunchAction(hasOpenRecord: boolean): KioskPunchAction {
  return hasOpenRecord ? 'clock_out' : 'clock_in';
}

/** Device keys are high-entropy secrets shown once at registration. */
export function isValidDeviceKey(key: string): boolean {
  return key.length >= 32 && key.length <= 128 && /^[A-Za-z0-9_-]+$/.test(key);
}
