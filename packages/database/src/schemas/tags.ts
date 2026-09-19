import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';
import { timeEntries } from './time.ts';

export const tags = pgTable(
  'tags',
  {
    id: generateEntityId('tag'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    ...generateTimestamps(),
  },
  (table) => [
    index('tags_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('tags_workspace_id_name_unique')
      .on(table.workspaceId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const timeEntryTags = pgTable(
  'time_entry_tags',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    timeEntryId: text('time_entry_id')
      .notNull()
      .references(() => timeEntries.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', TIMESTAMP_CONFIG).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.timeEntryId, table.tagId] }),
    index('time_entry_tags_workspace_id_tag_id_idx').on(table.workspaceId, table.tagId),
    index('time_entry_tags_workspace_id_time_entry_id_idx').on(
      table.workspaceId,
      table.timeEntryId,
    ),
  ],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TimeEntryTag = typeof timeEntryTags.$inferSelect;
export type NewTimeEntryTag = typeof timeEntryTags.$inferInsert;
