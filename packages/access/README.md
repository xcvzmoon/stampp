# @stampp/access

Workspace authorization boundary. Product handlers call `enterWorkspace` before touching data. The seam returns an `AuthorizedContext` already bound to one workspace.

## Interface

```ts
import { enterWorkspace, WorkspaceAccessError } from '@stampp/access';

const ctx = await enterWorkspace(
  {
    getSessionUserId, // from Better Auth session or PAT auth
    getActorGrant, // membership + role/permissions load
    db,
  },
  { workspaceId, permission: 'time:write:own' },
);

// ctx.userId, ctx.workspaceId, ctx.role, ctx.permissions, ctx.db
await ctx.db.client.select().from(timeEntries).where(eq(timeEntries.workspaceId, ctx.workspaceId));
```

`AuthorizedContext`:

| Field         | Meaning                            |
| ------------- | ---------------------------------- |
| `userId`      | Authenticated actor                |
| `workspaceId` | Tenancy root for every query       |
| `role`        | Built-in or custom role label      |
| `permissions` | Resolved permission set            |
| `db`          | `ScopedDb` from `@stampp/database` |

## Rules

- Fail closed: `WorkspaceAccessError` with `kind: 'unauthenticated' | 'forbidden'`.
- Permission strings come from `@stampp/domain` (`time:write:own`, `time:approve`, …). Do not invent parallel strings.
- Filter every query by `ctx.db.workspaceId` (or `ctx.workspaceId`). The scoped handle does not inject filters for you.
- Audit recording belongs in deep modules after a successful authorized action, not in this package.

## Test

```bash
vp run test packages/access
vp run typecheck
```
