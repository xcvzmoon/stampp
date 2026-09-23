import type { StamppRole } from '@stampp/domain';
import type { AuthorizedContext, WorkspaceAccessDeps } from '../src/index.ts';
import { createTestDb } from '@stampp/database';
import { builtinRolePermissions } from '@stampp/domain';
import { describe, expect, it } from 'vite-plus/test';
import { enterWorkspace, WorkspaceAccessError } from '../src/index.ts';

const workspaceId = '01900000-0000-7000-8000-000000000001';
const userId = '01900000-0000-7000-8000-000000000002';

function builtinGrant(role: StamppRole) {
  return {
    role: { kind: 'builtin' as const, role },
    permissions: builtinRolePermissions(role),
  };
}

function makeDeps(overrides: Partial<WorkspaceAccessDeps> = {}): WorkspaceAccessDeps {
  return {
    getSessionUserId: () => Promise.resolve(userId),
    getActorGrant: () => Promise.resolve(builtinGrant('member')),
    db: createTestDb(),
    ...overrides,
  };
}

function expectWorkspaceAccessError(
  promise: Promise<AuthorizedContext>,
  kind: 'unauthenticated' | 'forbidden',
) {
  return promise.then(
    () => {
      throw new Error('expected WorkspaceAccessError');
    },
    (error: WorkspaceAccessError | Error) => {
      expect(error).toBeInstanceOf(WorkspaceAccessError);
      if (error instanceof WorkspaceAccessError) {
        expect(error.kind).toBe(kind);
      }
    },
  );
}

describe('enterWorkspace', () => {
  it('returns authorized context for a permitted member', async () => {
    const ctx = await enterWorkspace(makeDeps(), {
      workspaceId,
      permission: 'time:write:own',
    });

    expect(ctx.userId).toBe(userId);
    expect(ctx.workspaceId).toBe(workspaceId);
    expect(ctx.role).toEqual({ kind: 'builtin', role: 'member' });
    expect(ctx.permissions.has('time:write:own')).toBe(true);
    expect(ctx.db.workspaceId).toBe(workspaceId);
    expect(ctx.db.client).toBeDefined();
  });

  it('rejects unauthenticated callers before membership lookup', async () => {
    let membershipLookups = 0;
    await expectWorkspaceAccessError(
      enterWorkspace(
        makeDeps({
          getSessionUserId: () => Promise.resolve(null),
          getActorGrant: () => {
            membershipLookups += 1;
            return Promise.resolve(builtinGrant('member'));
          },
        }),
        { workspaceId, permission: 'time:read:own' },
      ),
      'unauthenticated',
    );
    expect(membershipLookups).toBe(0);
  });

  it('rejects non-members', async () => {
    await expectWorkspaceAccessError(
      enterWorkspace(makeDeps({ getActorGrant: () => Promise.resolve(null) }), {
        workspaceId,
        permission: 'time:read:own',
      }),
      'forbidden',
    );
  });

  it('rejects members missing the required permission', async () => {
    await expectWorkspaceAccessError(
      enterWorkspace(makeDeps(), {
        workspaceId,
        permission: 'time:approve',
      }),
      'forbidden',
    );
  });

  it('allows managers to approve time', async () => {
    const ctx = await enterWorkspace(
      makeDeps({ getActorGrant: () => Promise.resolve(builtinGrant('manager')) }),
      { workspaceId, permission: 'time:approve' },
    );
    expect(ctx.role).toEqual({ kind: 'builtin', role: 'manager' });
  });

  it('passes the requested workspace id into membership lookup', async () => {
    const seen: string[] = [];
    await enterWorkspace(
      makeDeps({
        getActorGrant: (_userId, requestedWorkspaceId) => {
          seen.push(requestedWorkspaceId);
          return Promise.resolve(builtinGrant('owner'));
        },
      }),
      { workspaceId, permission: 'export:workspace' },
    );
    expect(seen).toEqual([workspaceId]);
  });

  it('allows owner workspace export', async () => {
    const ctx = await enterWorkspace(
      makeDeps({ getActorGrant: () => Promise.resolve(builtinGrant('owner')) }),
      {
        workspaceId,
        permission: 'export:workspace',
      },
    );
    expect(ctx.role).toEqual({ kind: 'builtin', role: 'owner' });
  });

  it('resolves custom role grants over the permission vocabulary', async () => {
    const ctx = await enterWorkspace(
      makeDeps({
        getActorGrant: () =>
          Promise.resolve({
            role: { kind: 'custom', roleId: 'crole_1', name: 'Billing' },
            permissions: new Set(['invoice:read:any']),
          }),
      }),
      { workspaceId, permission: 'invoice:read:any' },
    );
    expect(ctx.role).toEqual({ kind: 'custom', roleId: 'crole_1', name: 'Billing' });
    await expectWorkspaceAccessError(
      enterWorkspace(
        makeDeps({
          getActorGrant: () =>
            Promise.resolve({
              role: { kind: 'custom', roleId: 'crole_1', name: 'Billing' },
              permissions: new Set(['invoice:read:any']),
            }),
        }),
        { workspaceId, permission: 'settings:manage' },
      ),
      'forbidden',
    );
  });
});
