import type { ActorRole, Permission, StamppRole } from '@stampp/domain';
import type { H3Event } from 'nitro';
import {
  enterWorkspace,
  WorkspaceAccessError,
  type AuthorizedContext,
  type WorkspaceAccessDeps,
} from '@stampp/access';
import { applyWorkspaceRlsContext, customRoles, members } from '@stampp/database';
import { builtinRolePermissions, resolveActorPermissions } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq } from 'drizzle-orm';
import { useLogger } from 'evlog/nitro/v3';
import { readEventRequestId, toApiError } from '~/server/middleware/request-id.ts';
import { getAuth } from '~/server/utils/auth.ts';
import { getDb } from '~/server/utils/db.ts';
import { resolvePersonalAccessTokenUser } from '~/server/utils/personalAccessTokens.ts';

function toStamppRole(role: string): StamppRole | null {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'manager':
    case 'member':
    case 'guest':
      return role;
    default:
      return null;
  }
}

export function createWorkspaceAccessDeps(headers: Headers): WorkspaceAccessDeps {
  return {
    getSessionUserId: async () => {
      const authorization = headers.get('authorization');
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice('Bearer '.length).trim();
        const tokenUserId = await resolvePersonalAccessTokenUser(token);
        if (tokenUserId) {
          return tokenUserId;
        }
      }
      const session = await getAuth().api.getSession({ headers });
      return session?.user?.id ?? null;
    },
    getActorGrant: async (userId, workspaceId) => {
      const rows = await getDb()
        .select({ role: members.role, customRoleId: members.customRoleId })
        .from(members)
        .where(and(eq(members.userId, userId), eq(members.organizationId, workspaceId)))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return null;
      }

      if (row.customRoleId) {
        const roleRows = await getDb()
          .select()
          .from(customRoles)
          .where(
            and(eq(customRoles.id, row.customRoleId), eq(customRoles.workspaceId, workspaceId)),
          )
          .limit(1);
        const customRole = roleRows[0];
        if (customRole) {
          const actorRole: ActorRole = {
            kind: 'custom',
            roleId: customRole.id,
            name: customRole.name,
          };
          return {
            role: actorRole,
            permissions: resolveActorPermissions(actorRole, customRole.permissions),
          };
        }
      }

      const role = toStamppRole(row.role);
      if (!role) {
        return null;
      }
      const actorRole: ActorRole = { kind: 'builtin', role };
      return {
        role: actorRole,
        permissions: builtinRolePermissions(role),
      };
    },
    db: getDb(),
  };
}

export async function requireWorkspace(
  event: H3Event,
  permission: Permission,
): Promise<AuthorizedContext> {
  const requestId = readEventRequestId(event);
  const log = useLogger(event);
  const workspaceId = event.context.params?.workspaceId;
  if (!workspaceId) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'workspaceId is required', requestId);
  }

  try {
    const ctx = await enterWorkspace(createWorkspaceAccessDeps(event.req.headers), {
      workspaceId,
      permission,
    });
    await applyWorkspaceRlsContext(ctx.db.client, ctx.workspaceId).catch(() => undefined);
    log.set({
      workspace: {
        id: ctx.workspaceId,
        role: ctx.role,
        permission,
      },
    });
    return ctx;
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      log.set({
        workspace: {
          id: workspaceId,
          permission,
          denied: error.kind,
        },
      });
      const code =
        error.kind === 'unauthenticated' ? ERROR_CODES.UNAUTHENTICATED : ERROR_CODES.FORBIDDEN;
      throw toApiError(code, error.message, requestId);
    }
    throw error;
  }
}

export function requireParam(event: H3Event, name: string): string {
  const value = event.context.params?.[name];
  const requestId = readEventRequestId(event);
  if (!value) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, `${name} is required`, requestId);
  }
  return value;
}
