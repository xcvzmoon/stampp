import type { Db, ScopedDb } from '@stampp/database';
import type { Permission, StamppRole } from '@stampp/domain';
import { createScopedDb } from '@stampp/database';
import { hasPermission } from '@stampp/domain';

/**
 * Everything a product handler needs after authz: actor, workspace, role, scoped db.
 *
 * Use `db.workspaceId` in every query. Do not trust client-supplied membership.
 *
 * @example
 * ```ts
 * const ctx = await enterWorkspace(deps, {
 *   workspaceId,
 *   permission: 'time:write:own',
 * });
 *
 * await ctx.db.client
 *   .insert(timeEntries)
 *   .values({ workspaceId: ctx.db.workspaceId, userId: ctx.userId });
 * ```
 */
export type AuthorizedContext = {
  userId: string;
  workspaceId: string;
  role: StamppRole;
  db: ScopedDb;
};

/**
 * Injection points for session and membership. Wire these to Better Auth in apps/api.
 *
 * @example
 * ```ts
 * const deps: WorkspaceAccessDeps = {
 *   getSessionUserId: async () => (await auth.api.getSession({ headers }))?.user.id ?? null,
 *   getMemberRole: async (userId, workspaceId) => loadRole(userId, workspaceId),
 *   db,
 * };
 * ```
 */
export type WorkspaceAccessDeps = {
  getSessionUserId: () => Promise<string | null>;
  getMemberRole: (userId: string, workspaceId: string) => Promise<StamppRole | null>;
  db: Db;
};

export type EnterWorkspaceInput = {
  /** Path param `workspaces/:workspaceId` or explicit body field. */
  workspaceId: string;
  /** Permission required for the handler. */
  permission: Permission;
};

/**
 * Single authz seam for product routes.
 *
 * Order: session, membership, permission, scoped db. Throws {@link WorkspaceAccessError}.
 *
 * @example
 * ```ts
 * try {
 *   const ctx = await enterWorkspace(deps, {
 *     workspaceId: event.context.params.workspaceId,
 *     permission: 'time:approve',
 *   });
 *   return approveTimesheet(ctx, input);
 * } catch (error) {
 *   if (error instanceof WorkspaceAccessError && error.kind === 'unauthenticated') {
 *     throw new HTTPError({ status: 401, message: error.message });
 *   }
 *   throw error;
 * }
 * ```
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

/**
 * Authz failure from {@link enterWorkspace}.
 *
 * `kind` is `'unauthenticated'` (no session) or `'forbidden'` (no membership or permission).
 *
 * @example
 * ```ts
 * try {
 *   await enterWorkspace(deps, input);
 * } catch (error) {
 *   if (error instanceof WorkspaceAccessError) {
 *     console.info(error.kind, error.message);
 *   }
 * }
 * ```
 */
export class WorkspaceAccessError extends Error {
  readonly kind: 'unauthenticated' | 'forbidden';

  constructor(kind: 'unauthenticated' | 'forbidden', message: string) {
    super(message);
    this.name = 'WorkspaceAccessError';
    this.kind = kind;
  }
}
