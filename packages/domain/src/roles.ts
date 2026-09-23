import type { Permission, StamppRole } from './permissions.ts';
import { ALL_PERMISSIONS, hasPermission, rolePermissions } from './permissions.ts';

/** Display identity after authz: built-in ladder or a workspace custom role. */
export type ActorRole =
  | { kind: 'builtin'; role: StamppRole }
  | { kind: 'custom'; roleId: string; name: string };

export type PermissionGranter = StamppRole | ReadonlySet<Permission>;

export function builtinRolePermissions(role: StamppRole): ReadonlySet<Permission> {
  return rolePermissions[role];
}

export function isPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.some((permission) => permission === value);
}

/** Narrow stored permission arrays without forking the vocabulary. */
export function normalizePermissions(values: readonly string[]): Permission[] {
  const unique = new Set<Permission>();
  for (const value of values) {
    if (isPermission(value)) {
      unique.add(value);
    }
  }
  return [...unique];
}

export function isValidCustomRoleName(name: string): boolean {
  return name.trim().length >= 1 && name.trim().length <= 80;
}

export function resolveActorPermissions(
  role: ActorRole,
  customPermissions?: readonly string[],
): ReadonlySet<Permission> {
  if (role.kind === 'builtin') {
    return builtinRolePermissions(role.role);
  }
  return new Set(normalizePermissions(customPermissions ?? []));
}

export function can(permissions: ReadonlySet<Permission>, permission: Permission): boolean {
  return permissions.has(permission);
}

export function canAnySource(source: PermissionGranter, permission: Permission): boolean {
  return hasPermission(source, permission);
}
