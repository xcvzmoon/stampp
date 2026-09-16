import type { AnyPgColumn, UpdateDeleteAction } from 'drizzle-orm/pg-core';
import { timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

export type GenerateTimestampsWithAuditOptions =
  | {
      /** Usually `() => users.id` from the Better Auth users table. */
      userId: () => AnyPgColumn;
      createdByOnDelete?: UpdateDeleteAction;
      updatedByOnDelete?: UpdateDeleteAction;
      deletedByOnDelete?: UpdateDeleteAction;
    }
  | { userId?: undefined };

/**
 * Shared timestamptz(3) config. Milliseconds, timezone-aware, `Date` mode.
 *
 * @example
 * ```ts
 * timestamp('started_at', TIMESTAMP_CONFIG).notNull();
 * ```
 */
export const TIMESTAMP_CONFIG = {
  mode: 'date',
  precision: 3,
  withTimezone: true,
} as const;

/**
 * Primary key column: UUID type, default UUID v7.
 *
 * @param name - Column name. Defaults to `id`.
 *
 * @example
 * ```ts
 * export const projects = pgTable('projects', {
 *   id: generateUuid('id'),
 *   name: text('name').notNull(),
 * });
 * ```
 */
export function generateUuid(name?: string) {
  return uuid(name)
    .primaryKey()
    .$defaultFn(() => uuidv7());
}

/**
 * Non-primary UUID column with a v7 default. Use for foreign keys and plain ids.
 *
 * @example
 * ```ts
 * export const projectMembers = pgTable('project_members', {
 *   id: generateUuid('id'),
 *   projectId: generateUuidColumn('project_id')
 *     .notNull()
 *     .references(() => projects.id, { onDelete: 'cascade' }),
 * });
 * ```
 */
export function generateUuidColumn(name: string) {
  return uuid(name)
    .notNull()
    .$defaultFn(() => uuidv7());
}

/**
 * `created_at`, `updated_at`, and soft-delete `deleted_at`.
 *
 * `updatedAt` refreshes on update via `$onUpdateFn`.
 *
 * @example
 * ```ts
 * export const clients = pgTable('clients', {
 *   id: generateUuid('id'),
 *   name: text('name').notNull(),
 *   ...generateTimestamps(),
 * });
 * ```
 */
export function generateTimestamps() {
  return {
    createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', TIMESTAMP_CONFIG)
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at', TIMESTAMP_CONFIG),
  };
}

/**
 * Actor columns plus timestamps.
 *
 * Without `userId`, actor columns are plain UUIDs. With `userId`, they become foreign keys.
 * Defaults: `createdBy` restrict, `updatedBy`/`deletedBy` set null.
 *
 * @example
 * ```ts
 * // With user FKs
 * export const invoices = pgTable('invoices', {
 *   id: generateUuid('id'),
 *   ...generateTimestampsWithAudit({ userId: () => users.id }),
 * });
 *
 * // Without user FKs (import jobs, system rows)
 * export const importJobs = pgTable('import_jobs', {
 *   id: generateUuid('id'),
 *   ...generateTimestampsWithAudit(),
 * });
 * ```
 */
export function generateTimestampsWithAudit(options: GenerateTimestampsWithAuditOptions = {}) {
  if (options.userId) {
    const {
      userId,
      createdByOnDelete = 'restrict',
      updatedByOnDelete = 'set null',
      deletedByOnDelete = 'set null',
    } = options;

    return {
      createdBy: uuid('created_by').notNull().references(userId, { onDelete: createdByOnDelete }),
      updatedBy: uuid('updated_by').references(userId, {
        onDelete: updatedByOnDelete,
      }),
      deletedBy: uuid('deleted_by').references(userId, {
        onDelete: deletedByOnDelete,
      }),
      ...generateTimestamps(),
    };
  }

  return {
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by'),
    deletedBy: uuid('deleted_by'),
    ...generateTimestamps(),
  };
}
