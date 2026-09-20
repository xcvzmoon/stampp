import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';
import { clients, projects } from './projects.ts';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
export type InvoiceLineKind = 'time' | 'expense' | 'manual';

export const invoices = pgTable(
  'invoices',
  {
    id: generateEntityId('inv'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    number: varchar('number', { length: 32 }).notNull(),
    status: text('status').$type<InvoiceStatus>().notNull().default('draft'),
    issueDate: date('issue_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    currency: varchar('currency', { length: 3 }).notNull(),
    subtotalMinor: integer('subtotal_minor').notNull().default(0),
    discountMinor: integer('discount_minor').notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    taxMinor: integer('tax_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull().default(0),
    paidMinor: integer('paid_minor').notNull().default(0),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...generateTimestamps(),
  },
  (table) => [
    index('invoices_workspace_id_idx').on(table.workspaceId),
    index('invoices_workspace_id_status_idx').on(table.workspaceId, table.status),
    uniqueIndex('invoices_workspace_number_unique').on(table.workspaceId, table.number),
    check(
      'invoices_amounts_nonnegative_check',
      sql`${table.subtotalMinor} >= 0 and ${table.discountMinor} >= 0 and ${table.taxMinor} >= 0 and ${table.totalMinor} >= 0 and ${table.paidMinor} >= 0`,
    ),
  ],
);

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: generateEntityId('iline'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<InvoiceLineKind>().notNull(),
    sourceId: text('source_id'),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitAmountMinor: integer('unit_amount_minor').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...generateTimestamps(),
  },
  (table) => [
    index('invoice_lines_invoice_id_idx').on(table.invoiceId),
    index('invoice_lines_workspace_id_idx').on(table.workspaceId),
  ],
);

export const invoicePayments = pgTable(
  'invoice_payments',
  {
    id: generateEntityId('ipay'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amountMinor: integer('amount_minor').notNull(),
    paidAt: timestamp('paid_at', TIMESTAMP_CONFIG).notNull(),
    method: varchar('method', { length: 64 }),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...generateTimestamps(),
  },
  (table) => [
    index('invoice_payments_invoice_id_idx').on(table.invoiceId),
    index('invoice_payments_workspace_id_idx').on(table.workspaceId),
    check('invoice_payments_amount_positive_check', sql`${table.amountMinor} > 0`),
  ],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;
