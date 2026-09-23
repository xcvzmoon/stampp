export type StamppRole = 'owner' | 'admin' | 'manager' | 'member' | 'guest';

/**
 * Stable permission strings used by WorkspaceAccess and API handlers.
 * Keep these strings when adding custom roles so the vocabulary does not fork.
 */
export type Permission =
  | 'time:read:own'
  | 'time:read:team'
  | 'time:read:any'
  | 'time:write:own'
  | 'time:write:other'
  | 'time:approve'
  | 'project:read'
  | 'project:manage'
  | 'client:read'
  | 'client:manage'
  | 'tag:read'
  | 'tag:manage'
  | 'expense:read:own'
  | 'expense:read:any'
  | 'expense:write:own'
  | 'expense:manage'
  | 'attendance:read:own'
  | 'attendance:read:team'
  | 'attendance:read:any'
  | 'attendance:write:own'
  | 'attendance:manage'
  | 'timeoff:read:own'
  | 'timeoff:read:team'
  | 'timeoff:write:own'
  | 'timeoff:approve'
  | 'timeoff:manage'
  | 'schedule:read:own'
  | 'schedule:read:team'
  | 'schedule:manage'
  | 'kiosk:manage'
  | 'invoice:read:any'
  | 'invoice:manage'
  | 'reports:view'
  | 'reports:view:cost'
  | 'settings:manage'
  | 'members:manage'
  | 'export:workspace';

const ownerAdminPermissions: Permission[] = [
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
  'schedule:read:own',
  'schedule:read:team',
  'schedule:manage',
  'kiosk:manage',
  'invoice:read:any',
  'invoice:manage',
  'reports:view',
  'reports:view:cost',
  'settings:manage',
  'members:manage',
  'export:workspace',
];

const rolePermissions: Record<StamppRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>(ownerAdminPermissions),
  admin: new Set<Permission>(ownerAdminPermissions),
  manager: new Set<Permission>([
    'time:read:own',
    'time:read:team',
    'time:write:own',
    'time:write:other',
    'time:approve',
    'project:read',
    'project:manage',
    'client:read',
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
    'schedule:read:own',
    'schedule:read:team',
    'schedule:manage',
    'kiosk:manage',
    'invoice:read:any',
    'invoice:manage',
    'reports:view',
  ]),
  member: new Set<Permission>([
    'time:read:own',
    'time:write:own',
    'project:read',
    'client:read',
    'tag:read',
    'expense:read:own',
    'expense:write:own',
    'attendance:read:own',
    'attendance:write:own',
    'timeoff:read:own',
    'timeoff:write:own',
    'schedule:read:own',
    'reports:view',
  ]),
  guest: new Set<Permission>([
    'time:read:own',
    'project:read',
    'client:read',
    'tag:read',
    'expense:read:own',
    'attendance:read:own',
    'timeoff:read:own',
    'schedule:read:own',
  ]),
};

export function hasPermission(role: StamppRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
