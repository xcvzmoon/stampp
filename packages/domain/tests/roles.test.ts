import type { Permission } from '../src/permissions.ts';
import { describe, expect, it } from 'vite-plus/test';
import { ALL_PERMISSIONS, hasPermission } from '../src/permissions.ts';
import {
  normalizePermissions,
  resolveActorPermissions,
  isValidCustomRoleName,
} from '../src/roles.ts';

describe('custom role helpers', () => {
  it('keeps a single permission vocabulary', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    expect(normalizePermissions(['time:read:own', 'not-a-permission', 'time:read:own'])).toEqual([
      'time:read:own',
    ]);
  });

  it('resolves custom grants and builtin grants', () => {
    const custom = resolveActorPermissions({ kind: 'custom', roleId: 'crole_1', name: 'Billing' }, [
      'invoice:read:any',
      'reports:view',
    ]);
    expect(custom.has('invoice:read:any')).toBe(true);
    expect(custom.has('settings:manage')).toBe(false);
    expect(hasPermission(custom, 'reports:view')).toBe(true);

    const builtin = resolveActorPermissions({ kind: 'builtin', role: 'guest' });
    expect(builtin.has('time:write:own')).toBe(false);
  });

  it('validates custom role names', () => {
    expect(isValidCustomRoleName('Billing')).toBe(true);
    expect(isValidCustomRoleName('   ')).toBe(false);
    expect(isValidCustomRoleName('x'.repeat(81))).toBe(false);
  });

  it('accepts permission sets in hasPermission', () => {
    const set = new Set<Permission>(['tag:manage']);
    expect(hasPermission(set, 'tag:manage')).toBe(true);
    expect(hasPermission(set, 'tag:read')).toBe(false);
    expect(hasPermission('admin', 'tag:manage')).toBe(true);
  });
});
