import type { Db, ScopedDb } from '@stampp/database';
import type { Permission, StamppRole } from '@stampp/domain';
import { createScopedDb } from '@stampp/database';
import { hasPermission } from '@stampp/domain';

/**
 * Actor, workspace, role, and scoped db after authz.
 * Filter every query by `db.workspaceId`. Do not trust client-supplied membership.
 */
export type AuthorizedContext = {
  userId: string;
  workspaceId: string;
  role: StamppRole;
  db: ScopedDb;
};

export type WorkspaceAccessDeps = {
  getSessionUserId: () => Promise<string | null>;
  getMemberRole: (userId: string, workspaceId: string) => Promise<StamppRole | null>;
  db: Db;
};

export type EnterWorkspaceInput = {
  /** Path param `workspaces/:workspaceId` or explicit body field. */
  workspaceId: string;
  permission: Permission;
};

/**
 * Session → membership → permission → scoped db.
 * Throws {@link WorkspaceAccessError}.
 */
export async function enterWorkspace(
  deps: WorkspaceAccessDeps,
  input: EnterWorkspaceInput,
): Promise<AuthorizedContext> {
  const userId = await deps.getSessionUserId();
  if (!userId) {
    throw new WorkspaceAccessError('unauthenticated', 'Authentication required');
  }

  const role = await deps.getMemberRole(userId, input.workspaceId);
  if (!role) {
    throw new WorkspaceAccessError('forbidden', 'Not a member of this workspace');
  }

  if (!hasPermission(role, input.permission)) {
    throw new WorkspaceAccessError('forbidden', `Missing permission: ${input.permission}`);
  }

  return {
    userId,
    workspaceId: input.workspaceId,
    role,
    db: createScopedDb(deps.db, input.workspaceId),
  };
}

/** `kind` is `'unauthenticated'` or `'forbidden'`. */
export class WorkspaceAccessError extends Error {
  readonly kind: 'unauthenticated' | 'forbidden';

  constructor(kind: 'unauthenticated' | 'forbidden', message: string) {
    super(message);
    this.name = 'WorkspaceAccessError';
    this.kind = kind;
  }
}
