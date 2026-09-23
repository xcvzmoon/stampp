import type { AuthorizedContext } from '@stampp/access';
import type { Db } from '@stampp/database';
import { resolveActorPermissions } from '@stampp/domain';
import { drizzle } from 'drizzle-orm/postgres-js';

export type ScriptedQuery = {
  sql: string;
  params: readonly unknown[];
};

export type ScriptedRow = readonly unknown[];

export type ScriptedHandler = (sql: string, params: readonly unknown[]) => ScriptedRow[];

export type ScriptedDb = {
  db: Db;
  queries: ScriptedQuery[];
};

type UnsafeResult = Promise<ScriptedRow[]> & {
  values: () => Promise<ScriptedRow[]>;
};

type ScriptedClient = {
  options: { parsers: Record<string, never>; serializers: Record<string, never> };
  unsafe: (sql: string, params?: unknown[]) => UnsafeResult;
  begin: <T>(cb: (client: ScriptedClient) => Promise<T>) => Promise<T>;
  savepoint: <T>(cb: (client: ScriptedClient) => Promise<T>) => Promise<T>;
};

/**
 * Offline drizzle handle that serves positional rows from a handler.
 * Drizzle maps `row[i]` by SELECT order — fixtures must match column order.
 */
export function createScriptedDb(handler: ScriptedHandler): ScriptedDb {
  const queries: ScriptedQuery[] = [];

  const unsafe = (sql: string, params: unknown[] = []): UnsafeResult => {
    queries.push({ sql, params });
    const rows = handler(sql, params);
    return Object.assign(Promise.resolve(rows), { values: () => Promise.resolve(rows) });
  };

  const client: ScriptedClient = {
    options: { parsers: {}, serializers: {} },
    unsafe,
    begin: (cb) => cb(client),
    savepoint: (cb) => cb(client),
  };

  // Mirror `drizzle({ client })` without asserting to postgres.Sql. mock() only
  // needs options.parsers/serializers at construct time; the session then calls
  // unsafe/begin/savepoint on whatever client it holds.
  const db = drizzle.mock();
  Object.assign(db._.session, { client });
  return { db, queries };
}

export function scriptedContext(
  db: Db,
  workspaceId: string,
  userId: string,
  role: AuthorizedContext['role'] = { kind: 'builtin', role: 'member' },
): AuthorizedContext {
  const permissions = resolveActorPermissions(role, role.kind === 'custom' ? [] : undefined);
  return {
    userId,
    workspaceId,
    role,
    permissions,
    db: { workspaceId, client: db },
  };
}
