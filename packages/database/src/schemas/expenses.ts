import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';
import { projects } from './projects.ts';

export type ExpenseCategory = 'travel' | 'meals' | 'lodging' | 'software' | 'equipment' | 'other';

export type ExpenseStatus = 'open' | 'approved' | 'rejected';

export const expenses = pgTable(
  'expenses',
  {
    id: generateEntityId('exp'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    expenseDate: date('expense_date', { mode: 'string' }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    category: text('category').$type<ExpenseCategory>().notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    notes: text('notes'),
    billable: boolean('billable').notNull().default(false),
    status: text('status').$type<ExpenseStatus>().notNull().default('open'),
    receiptKey: text('receipt_key'),
    receiptFilename: varchar('receipt_filename', { length: 255 }),
    receiptContentType: varchar('receipt_content_type', { length: 100 }),
    receiptSizeBytes: integer('receipt_size_bytes'),
    ...generateTimestamps(),
  },
  (table) => [
    index('expenses_workspace_id_idx').on(table.workspaceId),
    index('expenses_workspace_id_user_id_expense_date_idx').on(
      table.workspaceId,
      table.userId,
      table.expenseDate,
    ),
    index('expenses_workspace_id_project_id_idx').on(table.workspaceId, table.projectId),
    index('expenses_workspace_id_status_idx').on(table.workspaceId, table.status),
    check('expenses_amount_minor_positive_check', sql`${table.amountMinor} > 0`),
  ],
);

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
