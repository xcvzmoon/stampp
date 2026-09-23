# @stampp/database

Drizzle schemas, connection helpers, workspace-scoped database handle, RLS helpers, and SQL migrations for Stampp.

## What lives here

| Path                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `src/client.ts`     | `createDb`, `createScopedDb`, `createTestDb`, `pingDb`            |
| `src/rls.ts`        | Workspace RLS table list and GUC name (`app.workspace_id`)        |
| `src/schemas/`      | One Drizzle schema module per aggregate (auth, time, invoices, …) |
| `migrations/`       | Drizzle-generated SQL applied by `deploy/docker/migrate.sh`       |
| `drizzle.config.ts` | drizzle-kit config (generate/migrate)                             |

## Usage

```ts
import { createDb, createScopedDb, pingDb } from '@stampp/database';

const db = createDb({ connectionString: process.env.DATABASE_URL });
const scoped = createScopedDb(db, workspaceId);
// scoped.client is the Drizzle handle; scoped.workspaceId brands the tenancy
```

`createScopedDb` does not rewrite queries. Handlers must still filter `workspace_id`. RLS is defense in depth and fails closed when the session GUC is missing.

For unit tests that need a `Db` without network, use `createTestDb()` (Drizzle mock).

## Migrations

Generate from schema changes (uses the API env via Varlock):

```bash
vp run --filter @stampp/database generate
```

Apply locally through Compose (`migrate` service) or:

```bash
vp run --filter @stampp/database migrate
```

Production and Docker Compose apply `migrations/*/migration.sql` with `deploy/docker/migrate.sh`, which records checksums and refuses to run if an applied file changed. Never edit a shipped migration; add a new one.

## Conventions

- Money stays in integer minor units.
- Every product table that belongs to a workspace carries `workspace_id` and is listed in `WORKSPACE_RLS_TABLES` when isolation applies.
- Prefer explicit FK names and indexes that match real query paths (list by workspace, filter by date range).
