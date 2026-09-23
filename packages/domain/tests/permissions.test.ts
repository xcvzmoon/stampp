import type { Permission, StamppRole } from '../src/permissions.ts';
import { describe, expect, it } from 'vite-plus/test';
import { hasPermission } from '../src/permissions.ts';

const allRoles: StamppRole[] = ['owner', 'admin', 'manager', 'member', 'guest'];

const allPermissions: Permission[] = [
  'time:read:own',
  'time:read:team',
  'time:read:any',
  'time:write:own',
  'time:write:other',
  'time:approve',
  'project:read',
  'project:manage',
  'client:read',
  'client:manage',
  'tag:read',
  'tag:manage',
  'expense:read:own',
  'expense:read:any',
  'expense:write:own',
  'expense:manage',
  'attendance:read:own',
  'attendance:read:team',
  'attendance:read:any',
  'attendance:write:own',
  'attendance:manage',
  'timeoff:read:own',
  'timeoff:read:team',
  'timeoff:write:own',
  'timeoff:approve',
  'timeoff:manage',
  'invoice:read:any',
  'invoice:manage',
  'reports:view',
  'reports:view:cost',
  'settings:manage',
  'members:manage',
  'export:workspace',
];

describe('hasPermission', () => {
  it('gives owners every permission', () => {
    for (const permission of allPermissions) {
      expect(hasPermission('owner', permission)).toBe(true);
    }
  });

  it('gives admins every permission', () => {
    for (const permission of allPermissions) {
      expect(hasPermission('admin', permission)).toBe(true);
    }
  });

  it('lets members write only their own time', () => {
    expect(hasPermission('member', 'time:write:own')).toBe(true);
    expect(hasPermission('member', 'time:write:other')).toBe(false);
    expect(hasPermission('member', 'time:read:own')).toBe(true);
    expect(hasPermission('member', 'time:read:any')).toBe(false);
  });

  it('lets managers approve time and manage projects but not members', () => {
    expect(hasPermission('manager', 'time:approve')).toBe(true);
    expect(hasPermission('manager', 'project:manage')).toBe(true);
    expect(hasPermission('manager', 'members:manage')).toBe(false);
    expect(hasPermission('manager', 'export:workspace')).toBe(false);
    expect(hasPermission('manager', 'reports:view:cost')).toBe(false);
    expect(hasPermission('manager', 'expense:read:any')).toBe(true);
    expect(hasPermission('manager', 'expense:manage')).toBe(true);
    expect(hasPermission('manager', 'invoice:manage')).toBe(true);
    expect(hasPermission('member', 'invoice:manage')).toBe(false);
  });

  it('lets members write only their own expenses', () => {
    expect(hasPermission('member', 'expense:read:own')).toBe(true);
    expect(hasPermission('member', 'expense:write:own')).toBe(true);
    expect(hasPermission('member', 'expense:read:any')).toBe(false);
    expect(hasPermission('member', 'expense:manage')).toBe(false);
  });

  it('scopes attendance to own punch for members and manage for managers', () => {
    expect(hasPermission('member', 'attendance:read:own')).toBe(true);
    expect(hasPermission('member', 'attendance:write:own')).toBe(true);
    expect(hasPermission('member', 'attendance:read:team')).toBe(false);
    expect(hasPermission('member', 'attendance:manage')).toBe(false);
    expect(hasPermission('manager', 'attendance:read:team')).toBe(true);
    expect(hasPermission('manager', 'attendance:manage')).toBe(true);
    expect(hasPermission('guest', 'attendance:read:own')).toBe(true);
    expect(hasPermission('guest', 'attendance:write:own')).toBe(false);
  });

  it('scopes time-off request and approval permissions by role', () => {
    expect(hasPermission('member', 'timeoff:read:own')).toBe(true);
    expect(hasPermission('member', 'timeoff:write:own')).toBe(true);
    expect(hasPermission('member', 'timeoff:approve')).toBe(false);
    expect(hasPermission('member', 'timeoff:manage')).toBe(false);
    expect(hasPermission('manager', 'timeoff:approve')).toBe(true);
    expect(hasPermission('manager', 'timeoff:manage')).toBe(true);
    expect(hasPermission('manager', 'timeoff:read:team')).toBe(true);
    expect(hasPermission('guest', 'timeoff:write:own')).toBe(false);
  });

  it('lets members read catalog entities but not manage them', () => {
    expect(hasPermission('member', 'client:read')).toBe(true);
    expect(hasPermission('member', 'project:read')).toBe(true);
    expect(hasPermission('member', 'tag:read')).toBe(true);
    expect(hasPermission('member', 'client:manage')).toBe(false);
    expect(hasPermission('member', 'project:manage')).toBe(false);
    expect(hasPermission('member', 'tag:manage')).toBe(false);
  });

  it('lets managers manage projects and tags but not clients', () => {
    expect(hasPermission('manager', 'project:manage')).toBe(true);
    expect(hasPermission('manager', 'client:read')).toBe(true);
    expect(hasPermission('manager', 'client:manage')).toBe(false);
    expect(hasPermission('manager', 'tag:manage')).toBe(true);
  });

  it('gives guests catalog read without manage or write', () => {
    const guestAllowed = new Set<Permission>([
      'time:read:own',
      'client:read',
      'project:read',
      'tag:read',
      'expense:read:own',
      'attendance:read:own',
      'timeoff:read:own',
    ]);
    for (const permission of allPermissions) {
      expect(hasPermission('guest', permission)).toBe(guestAllowed.has(permission));
    }
  });

  it('never denies a role a permission it should have via a different role', () => {
    for (const permission of allPermissions) {
      if (!hasPermission('member', permission)) continue;
      expect(hasPermission('manager', permission)).toBe(true);
      expect(hasPermission('admin', permission)).toBe(true);
      expect(hasPermission('owner', permission)).toBe(true);
    }
  });

  it('is defined for every role', () => {
    for (const role of allRoles) {
      expect(() => hasPermission(role, 'time:read:own')).not.toThrow();
    }
  });
});
