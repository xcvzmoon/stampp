import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Db = PostgresJsDatabase;

/** Handlers must still filter every query by `workspaceId`. */
export type ScopedDb = {
  readonly workspaceId: string;
  readonly client: Db;
};

export type CreateDbOptions = {
  connectionString: string;
  /** Defaults to 10. */
  max?: number;
  /** Defaults to false (safer behind pgbouncer). */
  prepare?: boolean;
};

/** Call once per process. Prefer `pingDb` for readiness checks. */
export function createDb(options: CreateDbOptions): Db {
  const client = postgres(options.connectionString, {
    max: options.max ?? 10,
    prepare: options.prepare ?? false,
  });
  return drizzle({ client });
}

/** Offline handle for unit tests. No network. */
export function createTestDb(): Db {
  return drizzle.mock();
}

/** Brands a {@link Db} with a workspace id. Does not rewrite queries. */
export function createScopedDb(db: Db, workspaceId: string): ScopedDb {
  return { workspaceId, client: db };
}

/** Returns false instead of throwing. */
export async function pingDb(db: Db): Promise<boolean> {
  try {
    await db.execute('select 1');
    return true;
  } catch {
    return false;
  }
}
