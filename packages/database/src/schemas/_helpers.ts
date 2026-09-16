import type { AnyPgColumn, UpdateDeleteAction } from 'drizzle-orm/pg-core';
import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

export type GenerateTimestampsWithAuditOptions =
  | {
      userId: () => AnyPgColumn;
      createdByOnDelete?: UpdateDeleteAction;
      updatedByOnDelete?: UpdateDeleteAction;
      deletedByOnDelete?: UpdateDeleteAction;
    }
  | { userId?: undefined };

export const TIMESTAMP_CONFIG = {
  mode: 'date',
  precision: 3,
  withTimezone: true,
} as const;

export function generateTextId(name = 'id') {
  return text(name).primaryKey();
}

export function generateUuid(name?: string) {
  return uuid(name)
    .primaryKey()
    .$defaultFn(() => uuidv7());
}

export function generateUuidColumn(name: string) {
  return uuid(name)
    .notNull()
    .$defaultFn(() => uuidv7());
}

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

export function generateAuthTimestamps() {
  return {
    createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', TIMESTAMP_CONFIG)
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  };
}

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
