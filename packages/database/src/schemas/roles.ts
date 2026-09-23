import { index, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

/**
 * Workspace-defined role. Permissions reuse the built-in vocabulary only.
 */
export const customRoles = pgTable(
  'custom_roles',
  {
    id: generateEntityId('crole'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    description: varchar('description', { length: 200 }),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    ...generateTimestamps(),
  },
  (table) => [
    index('custom_roles_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('custom_roles_workspace_name_unique').on(table.workspaceId, table.name),
  ],
);

export type CustomRole = typeof customRoles.$inferSelect;
export type NewCustomRole = typeof customRoles.$inferInsert;
