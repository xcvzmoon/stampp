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
  | 'reports:view'
  | 'reports:view:cost'
  | 'settings:manage'
  | 'members:manage'
  | 'export:workspace';

const rolePermissions: Record<StamppRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
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
    'reports:view',
    'reports:view:cost',
    'settings:manage',
    'members:manage',
    'export:workspace',
  ]),
  admin: new Set<Permission>([
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
    'reports:view',
    'reports:view:cost',
    'settings:manage',
    'members:manage',
    'export:workspace',
  ]),
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
    'reports:view',
  ]),
  member: new Set<Permission>([
    'time:read:own',
    'time:write:own',
    'project:read',
    'client:read',
    'tag:read',
    'reports:view',
  ]),
  guest: new Set<Permission>(['time:read:own', 'project:read', 'client:read', 'tag:read']),
};

export function hasPermission(role: StamppRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
