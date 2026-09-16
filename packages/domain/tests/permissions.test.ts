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
  });

  it('lets members read catalog entities but not manage them', () => {
    expect(hasPermission('member', 'client:read')).toBe(true);
    expect(hasPermission('member', 'project:read')).toBe(true);
    expect(hasPermission('member', 'client:manage')).toBe(false);
    expect(hasPermission('member', 'project:manage')).toBe(false);
  });

  it('lets managers manage projects and read clients but not manage clients', () => {
    expect(hasPermission('manager', 'project:manage')).toBe(true);
    expect(hasPermission('manager', 'client:read')).toBe(true);
    expect(hasPermission('manager', 'client:manage')).toBe(false);
  });

  it('gives guests catalog read without manage or write', () => {
    const guestAllowed = new Set<Permission>(['time:read:own', 'client:read', 'project:read']);
    for (const permission of allPermissions) {
      expect(hasPermission('guest', permission)).toBe(guestAllowed.has(permission));
    }
  });

  it('never denies a role a permission it should have via a different role', () => {
    // Cross-check: every permission granted to member is also granted to manager/admin/owner.
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
