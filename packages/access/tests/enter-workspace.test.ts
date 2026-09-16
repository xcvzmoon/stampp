import type { AuthorizedContext, WorkspaceAccessDeps } from '../src/index.ts';
import { createTestDb } from '@stampp/database';
import { describe, expect, it } from 'vite-plus/test';
import { enterWorkspace, WorkspaceAccessError } from '../src/index.ts';

const workspaceId = '01900000-0000-7000-8000-000000000001';
const userId = '01900000-0000-7000-8000-000000000002';

function makeDeps(overrides: Partial<WorkspaceAccessDeps> = {}): WorkspaceAccessDeps {
  return {
    getSessionUserId: () => Promise.resolve(userId),
    getMemberRole: () => Promise.resolve('member'),
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
    expect(ctx.role).toBe('member');
    expect(ctx.db.workspaceId).toBe(workspaceId);
    expect(ctx.db.client).toBeDefined();
  });

  it('rejects unauthenticated callers before membership lookup', async () => {
    let membershipLookups = 0;
    await expectWorkspaceAccessError(
      enterWorkspace(
        makeDeps({
          getSessionUserId: () => Promise.resolve(null),
          getMemberRole: () => {
            membershipLookups += 1;
            return Promise.resolve('member');
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
      enterWorkspace(makeDeps({ getMemberRole: () => Promise.resolve(null) }), {
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
      makeDeps({ getMemberRole: () => Promise.resolve('manager') }),
      { workspaceId, permission: 'time:approve' },
    );
    expect(ctx.role).toBe('manager');
  });

  it('passes the requested workspace id into membership lookup', async () => {
    const seen: string[] = [];
    await enterWorkspace(
      makeDeps({
        getMemberRole: (_userId, requestedWorkspaceId) => {
          seen.push(requestedWorkspaceId);
          return Promise.resolve('owner');
        },
      }),
      { workspaceId, permission: 'export:workspace' },
    );
    expect(seen).toEqual([workspaceId]);
  });

  it('allows owner workspace export', async () => {
    const ctx = await enterWorkspace(makeDeps({ getMemberRole: () => Promise.resolve('owner') }), {
      workspaceId,
      permission: 'export:workspace',
    });
    expect(ctx.role).toBe('owner');
  });
});
