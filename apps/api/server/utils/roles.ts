import type { AuthorizedContext } from '@stampp/access';
import type { CustomRole, Member, User } from '@stampp/database';
import type {
  AssignMemberRoleInput,
  CreateCustomRoleInput,
  CustomRoleDto,
  UpdateCustomRoleInput,
  WorkspaceMemberDto,
} from '@stampp/shared';
import { customRoles, members, users } from '@stampp/database';
import { normalizePermissions } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';

export function toCustomRoleDto(row: CustomRole): CustomRoleDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    permissions: normalizePermissions(row.permissions),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWorkspaceMemberDto(
  row: Member & { user: Pick<User, 'id' | 'name' | 'email'> },
  customRoleName: string | null,
): WorkspaceMemberDto {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name || null,
    email: row.user.email,
    role: row.role,
    customRoleId: row.customRoleId,
    customRoleName,
  };
}

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Custom role not found', requestId);
}

export async function listCustomRoles(ctx: AuthorizedContext): Promise<{ items: CustomRoleDto[] }> {
  const rows = await ctx.db.client
    .select()
    .from(customRoles)
    .where(and(eq(customRoles.workspaceId, ctx.workspaceId), isNull(customRoles.deletedAt)))
    .orderBy(customRoles.name);
  return { items: rows.map(toCustomRoleDto) };
}

export async function createCustomRole(
  ctx: AuthorizedContext,
  input: CreateCustomRoleInput,
  requestId: string,
): Promise<CustomRoleDto> {
  const permissions = normalizePermissions(input.permissions);
  if (permissions.length === 0) {
    throw toApiError(
      ERROR_CODES.ROLE_INVALID_PERMISSIONS,
      'Select at least one known permission',
      requestId,
    );
  }

  const inserted = await ctx.db.client
    .insert(customRoles)
    .values({
      workspaceId: ctx.workspaceId,
      name: input.name,
      description: input.description ?? null,
      permissions,
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create custom role', requestId);
  }

  await recordAudit(ctx, requestId, {
    action: 'role.created',
    entityType: 'custom_role',
    entityId: row.id,
    after: row,
  });
  return toCustomRoleDto(row);
}

async function getRoleRow(
  ctx: AuthorizedContext,
  roleId: string,
  requestId: string,
): Promise<CustomRole> {
  const rows = await ctx.db.client
    .select()
    .from(customRoles)
    .where(
      and(
        eq(customRoles.workspaceId, ctx.workspaceId),
        eq(customRoles.id, roleId),
        isNull(customRoles.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

export async function updateCustomRole(
  ctx: AuthorizedContext,
  roleId: string,
  input: UpdateCustomRoleInput,
  requestId: string,
): Promise<CustomRoleDto> {
  const before = await getRoleRow(ctx, roleId, requestId);
  const permissions =
    input.permissions === undefined ? before.permissions : normalizePermissions(input.permissions);
  if (input.permissions !== undefined && permissions.length === 0) {
    throw toApiError(
      ERROR_CODES.ROLE_INVALID_PERMISSIONS,
      'Select at least one known permission',
      requestId,
    );
  }

  const updated = await ctx.db.client
    .update(customRoles)
    .set({
      name: input.name ?? before.name,
      description: input.description === undefined ? before.description : input.description,
      permissions,
    })
    .where(and(eq(customRoles.workspaceId, ctx.workspaceId), eq(customRoles.id, roleId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);

  await recordAudit(ctx, requestId, {
    action: 'role.updated',
    entityType: 'custom_role',
    entityId: roleId,
    before,
    after: row,
  });
  return toCustomRoleDto(row);
}

export async function deleteCustomRole(
  ctx: AuthorizedContext,
  roleId: string,
  requestId: string,
): Promise<void> {
  const before = await getRoleRow(ctx, roleId, requestId);
  const assigned = await ctx.db.client
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.customRoleId, roleId), eq(members.organizationId, ctx.workspaceId)))
    .limit(1);
  if (assigned[0]) {
    throw toApiError(
      ERROR_CODES.ROLE_IN_USE,
      'Reassign members before deleting this role',
      requestId,
    );
  }

  await ctx.db.client
    .delete(customRoles)
    .where(and(eq(customRoles.workspaceId, ctx.workspaceId), eq(customRoles.id, roleId)));

  await recordAudit(ctx, requestId, {
    action: 'role.deleted',
    entityType: 'custom_role',
    entityId: roleId,
    before,
  });
}

export async function listWorkspaceMembers(
  ctx: AuthorizedContext,
): Promise<{ items: WorkspaceMemberDto[] }> {
  const rows = await ctx.db.client
    .select({
      id: members.id,
      userId: members.userId,
      role: members.role,
      customRoleId: members.customRoleId,
      createdAt: members.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, ctx.workspaceId));

  const roleIds = [
    ...new Set(rows.map((row) => row.customRoleId).filter((id): id is string => Boolean(id))),
  ];
  const roleNames = new Map<string, string>();
  if (roleIds.length > 0) {
    const roles = await ctx.db.client
      .select({ id: customRoles.id, name: customRoles.name })
      .from(customRoles)
      .where(eq(customRoles.workspaceId, ctx.workspaceId));
    for (const role of roles) {
      roleNames.set(role.id, role.name);
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.user.name || null,
      email: row.user.email,
      role: row.role,
      customRoleId: row.customRoleId,
      customRoleName: row.customRoleId ? (roleNames.get(row.customRoleId) ?? null) : null,
    })),
  };
}

export async function assignMemberRole(
  ctx: AuthorizedContext,
  memberId: string,
  input: AssignMemberRoleInput,
  requestId: string,
): Promise<WorkspaceMemberDto> {
  const memberRows = await ctx.db.client
    .select()
    .from(members)
    .where(and(eq(members.organizationId, ctx.workspaceId), eq(members.id, memberId)))
    .limit(1);
  const before = memberRows[0];
  if (!before) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'Member not found', requestId);
  }

  let customRoleName: string | null = null;
  if (input.customRoleId) {
    const role = await getRoleRow(ctx, input.customRoleId, requestId);
    customRoleName = role.name;
  }

  const updated = await ctx.db.client
    .update(members)
    .set({
      role: input.role ?? before.role,
      customRoleId: input.customRoleId === undefined ? before.customRoleId : input.customRoleId,
    })
    .where(and(eq(members.organizationId, ctx.workspaceId), eq(members.id, memberId)))
    .returning();
  const row = updated[0];
  if (!row) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'Member not found', requestId);
  }

  const userRows = await ctx.db.client
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'Member user not found', requestId);
  }

  await recordAudit(ctx, requestId, {
    action: 'member.role_assigned',
    entityType: 'member',
    entityId: memberId,
    before: { role: before.role, customRoleId: before.customRoleId },
    after: { role: row.role, customRoleId: row.customRoleId },
  });

  return toWorkspaceMemberDto({ ...row, user }, customRoleName);
}
