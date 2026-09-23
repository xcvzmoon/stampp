import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations } from './auth.ts';

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ImportSourceKind = 'csv' | 'clockify' | 'toggl' | 'harvest';

/** BullMQ-backed import run. Source payload stays in `payload` (CSV text or mapped rows). */
export const importJobs = pgTable(
  'import_jobs',
  {
    id: generateEntityId('imp'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    source: text('source').$type<ImportSourceKind>().notNull(),
    status: text('status').$type<ImportJobStatus>().notNull().default('pending'),
    totalRows: integer('total_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    payload: jsonb('payload').notNull().default({}),
    error: text('error'),
    ...generateTimestamps(),
  },
  (table) => [index('import_jobs_workspace_id_idx').on(table.workspaceId)],
);

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
