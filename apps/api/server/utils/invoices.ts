import type { AuthorizedContext } from '@stampp/access';
import type { Invoice, InvoiceLine, InvoicePayment } from '@stampp/database';
import type { RateCandidate } from '@stampp/domain';
import type {
  CreateInvoiceInput,
  GenerateInvoiceInput,
  InvoiceDto,
  InvoiceListQuery,
  RecordPaymentInput,
  UpdateInvoiceInput,
} from '@stampp/shared';
import {
  clients,
  expenses,
  invoiceLines,
  invoicePayments,
  invoices,
  projects,
  rates,
  timeEntries,
} from '@stampp/database';
import {
  canTransitionInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
  nextInvoiceStatus,
  resolveEffectiveRates,
} from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq, gt, gte, inArray, lte } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Invoice not found', requestId);
}

function invalidTransition(requestId: string, message: string) {
  return toApiError(ERROR_CODES.INVOICE_INVALID_TRANSITION, message, requestId);
}

export function toInvoiceDto(
  invoice: Invoice,
  lines: InvoiceLine[],
  payments: InvoicePayment[],
): InvoiceDto {
  return {
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    number: invoice.number,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotalMinor: invoice.subtotalMinor,
    discountMinor: invoice.discountMinor,
    taxRateBps: invoice.taxRateBps,
    taxMinor: invoice.taxMinor,
    totalMinor: invoice.totalMinor,
    paidMinor: invoice.paidMinor,
    balanceMinor: Math.max(0, invoice.totalMinor - invoice.paidMinor),
    notes: invoice.notes,
    lines: lines.map((line) => ({
      id: line.id,
      kind: line.kind,
      sourceId: line.sourceId,
      description: line.description,
      quantity: line.quantity,
      unitAmountMinor: line.unitAmountMinor,
      amountMinor: line.amountMinor,
      sortOrder: line.sortOrder,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amountMinor: payment.amountMinor,
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      notes: payment.notes,
    })),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

async function nextNumber(ctx: AuthorizedContext): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const rows = await ctx.db.client
    .select({ number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.workspaceId, ctx.workspaceId), gte(invoices.number, `${prefix}0001`)))
    .orderBy(asc(invoices.number));
  let max = 0;
  for (const row of rows) {
    const seq = Number(row.number.slice(prefix.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return formatInvoiceNumber(year, max + 1);
}

async function loadInvoiceBundle(
  ctx: AuthorizedContext,
  invoiceId: string,
  requestId: string,
): Promise<{ invoice: Invoice; lines: InvoiceLine[]; payments: InvoicePayment[] }> {
  const invoiceRows = await ctx.db.client
    .select()
    .from(invoices)
    .where(and(eq(invoices.workspaceId, ctx.workspaceId), eq(invoices.id, invoiceId)))
    .limit(1);
  const invoice = invoiceRows[0];
  if (!invoice) throw notFound(requestId);
  const lines = await ctx.db.client
    .select()
    .from(invoiceLines)
    .where(
      and(eq(invoiceLines.workspaceId, ctx.workspaceId), eq(invoiceLines.invoiceId, invoiceId)),
    )
    .orderBy(asc(invoiceLines.sortOrder), asc(invoiceLines.id));
  const payments = await ctx.db.client
    .select()
    .from(invoicePayments)
    .where(
      and(
        eq(invoicePayments.workspaceId, ctx.workspaceId),
        eq(invoicePayments.invoiceId, invoiceId),
      ),
    )
    .orderBy(asc(invoicePayments.paidAt), asc(invoicePayments.id));
  return { invoice, lines, payments };
}

async function resolveBillableRateMinor(
  ctx: AuthorizedContext,
  input: { userId: string; projectId: string | null; taskId: string | null; at: Date },
): Promise<number> {
  const rows = await ctx.db.client
    .select()
    .from(rates)
    .where(
      and(
        eq(rates.workspaceId, ctx.workspaceId),
        eq(rates.kind, 'billable'),
        lte(rates.effectiveFrom, input.at),
      ),
    );
  const candidates: RateCandidate[] = [];
  for (const row of rows) {
    candidates.push({
      scope: row.scope,
      amountMinor: row.amountMinor,
      currency: row.currency,
      userId: row.userId,
      projectId: row.projectId,
      taskId: row.taskId,
    });
  }
  const effective = resolveEffectiveRates(candidates, [], input);
  return effective.billable?.amountMinor ?? 0;
}

function entryMinutes(
  row: { durationMinutes: number | null; startAt: Date | null; endAt: Date | null },
  now: Date,
): number {
  if (row.durationMinutes !== null) return row.durationMinutes;
  if (!row.startAt) return 0;
  const endAt = row.endAt ?? now;
  return Math.max(0, Math.round((endAt.getTime() - row.startAt.getTime()) / 60_000));
}

export async function listInvoices(
  ctx: AuthorizedContext,
  options: InvoiceListQuery & { limit: number },
): Promise<{ items: InvoiceDto[]; nextCursor: string | null }> {
  const conditions = [eq(invoices.workspaceId, ctx.workspaceId)];
  if (options.cursor) conditions.push(gt(invoices.id, options.cursor));
  if (options.status) conditions.push(eq(invoices.status, options.status));
  if (options.clientId) conditions.push(eq(invoices.clientId, options.clientId));
  if (options.projectId) conditions.push(eq(invoices.projectId, options.projectId));

  const rows = await ctx.db.client
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(asc(invoices.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  const bundles = await Promise.all(
    page.map((invoice) => loadInvoiceBundle(ctx, invoice.id, 'invoice-list')),
  );
  const items: InvoiceDto[] = [];
  for (const bundle of bundles) {
    items.push(toInvoiceDto(bundle.invoice, bundle.lines, bundle.payments));
  }
  return {
    items,
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function getInvoice(
  ctx: AuthorizedContext,
  invoiceId: string,
  requestId: string,
): Promise<InvoiceDto> {
  const bundle = await loadInvoiceBundle(ctx, invoiceId, requestId);
  return toInvoiceDto(bundle.invoice, bundle.lines, bundle.payments);
}

export async function createInvoice(
  ctx: AuthorizedContext,
  input: CreateInvoiceInput,
  requestId: string,
): Promise<InvoiceDto> {
  const discountMinor = input.discountMinor ?? 0;
  const taxRateBps = input.taxRateBps ?? 0;
  const totals = computeInvoiceTotals(input.lines, discountMinor, taxRateBps);

  const number = await nextNumber(ctx);
  const invoice = await ctx.db.client.transaction(async (tx) => {
    const inserted = await tx
      .insert(invoices)
      .values({
        workspaceId: ctx.workspaceId,
        clientId: input.clientId ?? null,
        projectId: input.projectId ?? null,
        number,
        status: 'draft',
        issueDate: input.issueDate,
        dueDate: input.dueDate ?? null,
        currency: input.currency,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        taxRateBps,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    const created = inserted[0];
    if (!created) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create invoice', requestId);
    }
    const lineValues = input.lines.map((line, index) => ({
      workspaceId: ctx.workspaceId,
      invoiceId: created.id,
      kind: line.kind,
      sourceId: line.sourceId ?? null,
      description: line.description,
      quantity: line.quantity,
      unitAmountMinor: line.unitAmountMinor,
      amountMinor: line.quantity * line.unitAmountMinor,
      sortOrder: index,
    }));
    if (lineValues.length > 0) {
      await tx.insert(invoiceLines).values(lineValues);
    }
    return created;
  });

  await recordAudit(ctx, requestId, {
    action: 'invoice.created',
    entityType: 'invoice',
    entityId: invoice.id,
    after: invoice,
  });
  return getInvoice(ctx, invoice.id, requestId);
}

export async function generateInvoice(
  ctx: AuthorizedContext,
  input: GenerateInvoiceInput,
  requestId: string,
): Promise<InvoiceDto> {
  if (input.from > input.to) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'from must not be after to', requestId);
  }
  const now = new Date();
  const timeRows = await ctx.db.client
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      projectId: timeEntries.projectId,
      taskId: timeEntries.taskId,
      description: timeEntries.description,
      durationMinutes: timeEntries.durationMinutes,
      startAt: timeEntries.startAt,
      endAt: timeEntries.endAt,
      workDate: timeEntries.workDate,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, ctx.workspaceId),
        eq(timeEntries.billable, true),
        gte(timeEntries.workDate, input.from),
        lte(timeEntries.workDate, input.to),
      ),
    );
  const expenseRows = await ctx.db.client
    .select({
      id: expenses.id,
      projectId: expenses.projectId,
      description: expenses.description,
      amountMinor: expenses.amountMinor,
      currency: expenses.currency,
      expenseDate: expenses.expenseDate,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.workspaceId, ctx.workspaceId),
        eq(expenses.billable, true),
        eq(expenses.status, 'approved'),
        gte(expenses.expenseDate, input.from),
        lte(expenses.expenseDate, input.to),
      ),
    );

  const lines: CreateInvoiceInput['lines'] = [];
  const projectNames = new Map<string, string>();
  const projectClients = new Map<string, string | null>();
  const projectIds = new Set<string>();
  for (const row of timeRows) {
    if (row.projectId) projectIds.add(row.projectId);
  }
  for (const row of expenseRows) {
    if (row.projectId) projectIds.add(row.projectId);
  }
  if (projectIds.size > 0) {
    const projectRows = await ctx.db.client
      .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
      .from(projects)
      .where(and(eq(projects.workspaceId, ctx.workspaceId), inArray(projects.id, [...projectIds])));
    for (const project of projectRows) {
      projectNames.set(project.id, project.name);
      projectClients.set(project.id, project.clientId);
    }
  }

  const timeCandidates: { row: (typeof timeRows)[number]; minutes: number }[] = [];
  for (const row of timeRows) {
    if (input.projectId && row.projectId !== input.projectId) continue;
    const minutes = entryMinutes(row, now);
    if (minutes <= 0) continue;
    timeCandidates.push({ row, minutes });
  }

  const timeRates = await Promise.all(
    timeCandidates.map((candidate) =>
      resolveBillableRateMinor(ctx, {
        userId: candidate.row.userId,
        projectId: candidate.row.projectId,
        taskId: candidate.row.taskId,
        at: new Date(`${candidate.row.workDate}T12:00:00.000Z`),
      }),
    ),
  );

  for (const [index, candidate] of timeCandidates.entries()) {
    const unit = timeRates[index] ?? 0;
    if (unit <= 0) continue;
    const projectName = candidate.row.projectId
      ? (projectNames.get(candidate.row.projectId) ?? 'No project')
      : 'No project';
    lines.push({
      kind: 'time',
      sourceId: candidate.row.id,
      description: `${projectName} — ${candidate.row.description || candidate.row.workDate}`,
      quantity: Math.max(1, Math.round(candidate.minutes / 60)),
      unitAmountMinor: unit,
    });
  }

  if (input.includeExpenses !== false) {
    for (const row of expenseRows) {
      if (input.projectId && row.projectId !== input.projectId) continue;
      if (input.clientId) {
        const clientId = row.projectId ? (projectClients.get(row.projectId) ?? null) : null;
        if (clientId !== input.clientId) continue;
      }
      if (row.currency !== input.currency) continue;
      lines.push({
        kind: 'expense',
        sourceId: row.id,
        description: row.description || `Expense ${row.expenseDate}`,
        quantity: 1,
        unitAmountMinor: row.amountMinor,
      });
    }
  }

  if (lines.length === 0) {
    throw toApiError(
      ERROR_CODES.INVOICE_EMPTY,
      'No billable time or expenses found for the selected range',
      requestId,
    );
  }

  if (input.clientId) {
    const clientRows = await ctx.db.client
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.workspaceId, ctx.workspaceId), eq(clients.id, input.clientId)))
      .limit(1);
    if (!clientRows[0]) {
      throw toApiError(ERROR_CODES.BAD_REQUEST, 'Client not found', requestId);
    }
  }

  return createInvoice(
    ctx,
    {
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      issueDate: input.issueDate,
      dueDate: input.dueDate ?? null,
      currency: input.currency,
      taxRateBps: input.taxRateBps ?? 0,
      notes: input.notes ?? null,
      lines,
    },
    requestId,
  );
}

export async function updateInvoiceDraft(
  ctx: AuthorizedContext,
  invoiceId: string,
  input: UpdateInvoiceInput,
  requestId: string,
): Promise<InvoiceDto> {
  const bundle = await loadInvoiceBundle(ctx, invoiceId, requestId);
  if (bundle.invoice.status !== 'draft') {
    throw toApiError(ERROR_CODES.INVOICE_NOT_DRAFT, 'Only draft invoices can be edited', requestId);
  }
  const discountMinor = input.discountMinor ?? bundle.invoice.discountMinor;
  const taxRateBps = input.taxRateBps ?? bundle.invoice.taxRateBps;
  const lineInputs = bundle.lines.map((line) => ({
    quantity: line.quantity,
    unitAmountMinor: line.unitAmountMinor,
  }));
  const totals = computeInvoiceTotals(lineInputs, discountMinor, taxRateBps);

  const updated = await ctx.db.client
    .update(invoices)
    .set({
      clientId: input.clientId === undefined ? bundle.invoice.clientId : input.clientId,
      projectId: input.projectId === undefined ? bundle.invoice.projectId : input.projectId,
      issueDate: input.issueDate ?? bundle.invoice.issueDate,
      dueDate: input.dueDate === undefined ? bundle.invoice.dueDate : input.dueDate,
      notes: input.notes === undefined ? bundle.invoice.notes : input.notes,
      discountMinor,
      taxRateBps,
      subtotalMinor: totals.subtotalMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.workspaceId, ctx.workspaceId), eq(invoices.id, invoiceId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: 'invoice.updated',
    entityType: 'invoice',
    entityId: invoiceId,
    before: bundle.invoice,
    after: row,
  });
  return getInvoice(ctx, invoiceId, requestId);
}

export async function transitionInvoice(
  ctx: AuthorizedContext,
  invoiceId: string,
  action: 'send' | 'pay' | 'void',
  requestId: string,
): Promise<InvoiceDto> {
  const bundle = await loadInvoiceBundle(ctx, invoiceId, requestId);
  if (!canTransitionInvoice(action, bundle.invoice.status)) {
    throw invalidTransition(
      requestId,
      `Cannot ${action} invoice in status ${bundle.invoice.status}`,
    );
  }
  const status = nextInvoiceStatus(action);
  const updated = await ctx.db.client
    .update(invoices)
    .set({
      status,
      paidMinor: status === 'paid' ? bundle.invoice.totalMinor : bundle.invoice.paidMinor,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.workspaceId, ctx.workspaceId), eq(invoices.id, invoiceId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: `invoice.${action === 'send' ? 'sent' : action === 'pay' ? 'paid' : 'voided'}`,
    entityType: 'invoice',
    entityId: invoiceId,
    before: bundle.invoice,
    after: row,
  });
  return getInvoice(ctx, invoiceId, requestId);
}

export async function recordInvoicePayment(
  ctx: AuthorizedContext,
  invoiceId: string,
  input: RecordPaymentInput,
  requestId: string,
): Promise<InvoiceDto> {
  const bundle = await loadInvoiceBundle(ctx, invoiceId, requestId);
  if (bundle.invoice.status === 'void' || bundle.invoice.status === 'paid') {
    throw invalidTransition(requestId, `Cannot record payment on ${bundle.invoice.status} invoice`);
  }
  const balance = bundle.invoice.totalMinor - bundle.invoice.paidMinor;
  if (input.amountMinor > balance) {
    throw toApiError(
      ERROR_CODES.INVOICE_OVERPAYMENT,
      `Payment exceeds remaining balance of ${balance}`,
      requestId,
    );
  }
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const paidMinor = bundle.invoice.paidMinor + input.amountMinor;

  await ctx.db.client.transaction(async (tx) => {
    await tx.insert(invoicePayments).values({
      workspaceId: ctx.workspaceId,
      invoiceId,
      amountMinor: input.amountMinor,
      paidAt,
      method: input.method ?? null,
      notes: input.notes ?? null,
      createdBy: ctx.userId,
    });
    await tx
      .update(invoices)
      .set({
        paidMinor,
        status: paidMinor >= bundle.invoice.totalMinor ? 'paid' : 'sent',
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.workspaceId, ctx.workspaceId), eq(invoices.id, invoiceId)));
  });

  await recordAudit(ctx, requestId, {
    action: 'invoice.payment_recorded',
    entityType: 'invoice',
    entityId: invoiceId,
    before: bundle.invoice,
    after: { paidMinor },
  });
  return getInvoice(ctx, invoiceId, requestId);
}

export async function listInvoicesForExport(ctx: AuthorizedContext): Promise<Invoice[]> {
  return ctx.db.client
    .select()
    .from(invoices)
    .where(eq(invoices.workspaceId, ctx.workspaceId))
    .orderBy(asc(invoices.id));
}

export async function loadInvoicePdfInput(
  ctx: AuthorizedContext,
  invoiceId: string,
  requestId: string,
): Promise<InvoiceDto> {
  return getInvoice(ctx, invoiceId, requestId);
}
