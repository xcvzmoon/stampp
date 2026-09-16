import type { AuthorizedContext, WorkspaceAccessDeps } from '@stampp/access';
import type { Permission, StamppRole } from '@stampp/domain';
import type { H3Event } from 'nitro';
import { enterWorkspace, WorkspaceAccessError } from '@stampp/access';
import { members } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq } from 'drizzle-orm';
import { readEventRequestId, toApiError } from '../middleware/request-id.ts';
import { getAuth } from './auth.ts';
import { getDb } from './db.ts';

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
      const session = await getAuth().api.getSession({ headers });
      return session?.user?.id ?? null;
    },
    getMemberRole: async (userId, workspaceId) => {
      const rows = await getDb()
        .select({ role: members.role })
        .from(members)
        .where(and(eq(members.userId, userId), eq(members.organizationId, workspaceId)))
        .limit(1);
      const role = rows[0]?.role;
      return role ? toStamppRole(role) : null;
    },
    db: getDb(),
  };
}

export async function requireWorkspace(
  event: H3Event,
  permission: Permission,
): Promise<AuthorizedContext> {
  const requestId = readEventRequestId(event);
  const workspaceId = event.context.params?.workspaceId;
  if (!workspaceId) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'workspaceId is required', requestId);
  }

  try {
    return await enterWorkspace(createWorkspaceAccessDeps(event.req.headers), {
      workspaceId,
      permission,
    });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
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
