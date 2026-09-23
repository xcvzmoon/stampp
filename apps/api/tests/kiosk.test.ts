import type { KioskDevice, KioskMemberCredential } from '@stampp/database';
import { isValidKioskPin, resolveKioskPunchAction } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { toKioskCredentialDto, toKioskDeviceDto } from '~/server/utils/kiosk.ts';

describe('kiosk error status mapping', () => {
  it('maps auth failure to 401 and revoked device to 403', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.KIOSK_AUTH_FAILED)).toBe(401);
    expect(mapErrorCodeToStatus(ERROR_CODES.KIOSK_DEVICE_REVOKED)).toBe(403);
  });
});

function makeDevice(partial: Partial<KioskDevice> = {}): KioskDevice {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'kdev_1',
    workspaceId: 'ws_1',
    name: 'Front desk',
    keyPrefix: 'abcd1234',
    deviceKeyHash: 'deadbeef',
    status: 'active',
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function makeCredential(partial: Partial<KioskMemberCredential> = {}): KioskMemberCredential {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'kcred_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    pinHash: 'abc',
    pinSalt: 'salt',
    qrTokenHash: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

describe('kiosk service helpers', () => {
  it('maps device without exposing key hash', () => {
    const dto = toKioskDeviceDto(makeDevice());
    expect(dto.keyPrefix).toBe('abcd1234');
    expect(dto.status).toBe('active');
    expect('deviceKeyHash' in dto).toBe(false);
  });

  it('maps credential methods without secrets', () => {
    const withPin = toKioskCredentialDto(makeCredential());
    expect(withPin.hasPin).toBe(true);
    expect(withPin.hasQrToken).toBe(false);
    expect('pinHash' in withPin).toBe(false);

    const withQr = toKioskCredentialDto(
      makeCredential({ pinHash: null, pinSalt: null, qrTokenHash: 'x:y' }),
    );
    expect(withQr.hasPin).toBe(false);
    expect(withQr.hasQrToken).toBe(true);
  });

  it('validates PIN and punch toggle', () => {
    expect(isValidKioskPin('4821')).toBe(true);
    expect(resolveKioskPunchAction(false)).toBe('clock_in');
    expect(resolveKioskPunchAction(true)).toBe('clock_out');
  });
});
