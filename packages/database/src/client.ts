import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Postgres.js Drizzle handle. Product code talks to this type, not to `postgres` directly.
 *
 * @example
 * ```ts
 * const db = createDb({ connectionString: process.env.DATABASE_URL! });
 * const rows = await db.execute('select 1');
 * ```
 */
export type Db = PostgresJsDatabase;

/**
 * Workspace-branded database handle. `client` is the raw {@link Db}; `workspaceId` is the tenancy root.
 *
 * Handlers should filter every query by `workspaceId`.
 *
 * @example
 * ```ts
 * const scoped = createScopedDb(db, workspaceId);
 * await scoped.client
 *   .select()
 *   .from(timeEntries)
 *   .where(eq(timeEntries.workspaceId, scoped.workspaceId));
 * ```
 */
export type ScopedDb = {
  readonly workspaceId: string;
  readonly client: Db;
};

export type CreateDbOptions = {
  /** Postgres connection string, for example `postgres://user:pass@host:5432/stampp`. */
  connectionString: string;
  /** Pool size. Defaults to 10. */
  max?: number;
  /** Prepared statements. Defaults to false (safer behind pgbouncer). */
  prepare?: boolean;
};

/**
 * Opens a Postgres connection pool and returns a Drizzle instance.
 *
 * Call once per process. Prefer `pingDb` for readiness checks.
 *
 * @example
 * ```ts
 * const db = createDb({
 *   connectionString: process.env.DATABASE_URL!,
 *   max: 10,
 * });
 * ```
 */
export function createDb(options: CreateDbOptions): Db {
  const client = postgres(options.connectionString, {
    max: options.max ?? 10,
    prepare: options.prepare ?? false,
  });
  return drizzle({ client });
}

/**
 * Offline Drizzle handle for unit tests. No network, no real queries.
 *
 * @example
 * ```ts
 * const deps = {
 *   getSessionUserId: () => Promise.resolve('user_1'),
 *   getMemberRole: () => Promise.resolve('member'),
 *   db: createTestDb(),
 * };
 * ```
 */
export function createTestDb(): Db {
  return drizzle.mock();
}

/**
 * Brands a {@link Db} with a workspace id for tenant-scoped handlers.
 *
 * Does not rewrite queries. Callers still filter by `workspaceId`.
 *
 * @example
 * ```ts
 * const scoped = createScopedDb(db, '01900000-0000-7000-8000-0000000000aa');
 * scoped.workspaceId; // '01900000-0000-7000-8000-0000000000aa'
 * scoped.client === db; // true
 * ```
 */
export function createScopedDb(db: Db, workspaceId: string): ScopedDb {
  return { workspaceId, client: db };
}

/**
 * Lightweight readiness probe. Returns false instead of throwing.
 *
 * @example
 * ```ts
 * if (!(await pingDb(db))) {
 *   // fail /readyz
 * }
 * ```
 */
export async function pingDb(db: Db): Promise<boolean> {
  try {
    await db.execute('select 1');
    return true;
  } catch {
    return false;
  }
}
